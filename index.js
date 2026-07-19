const { Client } = require('discord.js-selfbot-v13');
const { setTimeout: wait } = require('timers/promises');
const { execSync } = require('child_process');

const config = {
  token: process.env.DISCORD_TOKEN, 
  ownerId: process.env.OWNER_ID, 
  channelId: process.env.CHANNEL_ID,
  mensaje: process.env.MENSAJE_USER || 'Aquí va tu texto base xd', 
  githubToken: process.env.GITHUB_TOKEN,
  runIdActual: process.env.RUN_ID_ACTUAL,
  repo: process.env.GITHUB_REPOSITORY,
  idControl: '1453853523384078399' // <-- Tu servidor para tirar los comandos
};

const client = new Client({ checkUpdate: false, readyStatus: false });

// MAPA DE ESTADOS: Aquí guardamos quién está pausado (ID -> true/false)
const canalesPausados = new Map(); 

const TIEMPO_RELEVO = 4 * 60 * 60 * 1000; 
const TIEMPO_GRACIA = 10 * 60 * 1000;

process.on('unhandledRejection', (err) => console.log('LOG ERROR INTERNO:', err.message));
process.on('uncaughtException', (err) => console.log('LOG EXCEPCION INTERNA:', err.message));

client.on('ready', async () => {
    console.log(`=========================================`);
    console.log(`LOGIN EXITOSO -> Cuenta: ${client.user.tag}`);
    console.log(`=========================================`);
    
    // Iniciar relevo
    iniciarTemporizadorRelevo();

    if (config.channelId) {
        const channel = await client.channels.fetch(config.channelId).catch(() => null);
        if (channel && channel.isText()) {
            console.log(`🔥 Empezando envíos automáticos en #${channel.name}`);
            runAdaptiveSender(channel);
        }
    }
});

// ==========================================================
// CONTROL GRANULAR: !stop ID o !start ID
// ==========================================================
client.on('messageCreate', async (msg) => {
    if (msg.author.id !== config.ownerId) return;
    
    // Verificamos que sea tu server de control
    if (msg.guild?.id === config.idControl || msg.channel.id === config.idControl) {
        const args = msg.content.split(' ');
        const comando = args[0]; // !stop o !start
        const targetId = args[1]; // La ID del canal

        if (!targetId) return; // Si no pusiste ID, no hace nada

        if (comando === '!stop') {
            canalesPausados.set(targetId, true);
            console.log(`🛑 [PAUSADO] Canal: ${targetId}`);
            msg.react('🛑').catch(() => {});
        } else if (comando === '!start') {
            canalesPausados.set(targetId, false);
            console.log(`✅ [REANUDADO] Canal: ${targetId}`);
            msg.react('✅').catch(() => {});
        }
    }
});

async function runAdaptiveSender(channel) {
    let contador = 0;
    try {
        let cooldownBase = 10000;
        while (true) { // Bucle infinito
            
            // CHECKER: ¿Está pausado este canal específico?
            if (canalesPausados.get(channel.id) === true) {
                await wait(5000); // Espera 5s antes de volver a mirar si ya lo activaste
                continue;
            }

            const mensajeFinal = `${config.mensaje} [${Math.floor(Math.random() * 900) + 100}-ID]`;
            try {
                contador++;
                await channel.send(mensajeFinal);
                await wait(cooldownBase);
            } catch (e) {
                await wait(10000);
            }
        }
    } catch (error) {
        await wait(15000);
        runAdaptiveSender(channel);
    }
}

// ... (la función iniciarTemporizadorRelevo queda exactamente igual)
function iniciarTemporizadorRelevo() {
    setTimeout(async () => {
        try {
            const msgEscapado = config.mensaje.replace(/"/g, '\\"');
            const comandoTrigger = `curl -X POST -H "Authorization: token ${config.githubToken}" https://api.github.com/repos/${config.repo}/actions/workflows/main.yml/dispatches -d '{"ref":"main", "inputs": {"user_id": "${config.ownerId}", "channel_id": "${config.channelId}", "mensaje_personalizado": "${msgEscapado}", "clavesita_segura": "${config.token}"}}'`;
            execSync(comandoTrigger);
            await wait(TIEMPO_GRACIA);
            const comandoBorrar = `curl -X DELETE -H "Authorization: token ${config.githubToken}" https://api.github.com/repos/${config.repo}/actions/runs/${config.runIdActual}`;
            execSync(comandoBorrar);
            process.exit(0);
        } catch (error) { console.log("Error relevo:", error.message); }
    }, TIEMPO_RELEVO);
}

if (config.token) {
    client.login(config.token).catch((err) => console.log("❌ Error Login:", err.message));
}
