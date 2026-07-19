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
  repo: process.env.GITHUB_REPOSITORY
};

const client = new Client({ checkUpdate: false, readyStatus: false });
const canalesActivos = new Map();

// Tiempos del relevo (4 horas activo, 10 minutos de gracia para morir)
const TIEMPO_RELEVO = 4 * 60 * 60 * 1000; 
const TIEMPO_GRACIA = 10 * 60 * 1000;

process.on('unhandledRejection', (err) => console.log('LOG ERROR INTERNO:', err.message));
process.on('uncaughtException', (err) => console.log('LOG EXCEPCION INTERNA:', err.message));

client.on('ready', async () => {
    console.log(`=========================================`);
    console.log(`LOGIN EXITOSO -> Cuenta: ${client.user.tag}`);
    console.log(`=========================================`);
    
    if (config.channelId) {
        console.log(`🚀 AUTO-ACTIVADO: Conectando al canal ID [${config.channelId}]...`);
        
        canalesActivos.set(config.channelId, true);
        iniciarTemporizadorRelevo();

        const channel = await client.channels.fetch(config.channelId).catch(() => null);
        if (channel && channel.isText()) {
            console.log(`🔥 Empezando envíos automáticos en #${channel.name}`);
            runAdaptiveSender(channel);
        } else {
            console.log("❌ Error: No se encontró el canal o no hay accesos.");
            process.exit(1);
        }
    } else {
        console.log("❌ ERROR CRÍTICO: No especificaste una ID de canal.");
        process.exit(1);
    }
});

function generarIdAleatoria() {
    const numero = Math.floor(Math.random() * 900) + 100;
    return `[${numero}-ID]`;
}

async function runAdaptiveSender(channel) {
    const canalId = channel.id;
    let contador = 0;

    try {
        let cooldownBase = 10000; 
        if (channel.rateLimitPerUser && channel.rateLimitPerUser > 0) {
            cooldownBase = (channel.rateLimitPerUser + 1) * 1000;
        }

        while (canalesActivos.get(canalId) === true) {
            const mensajeFinal = `${config.mensaje} ${generarIdAleatoria()}`;
            
            try {
                contador++;
                await channel.send(mensajeFinal);
                console.log(`✉️ [#${contador} en #${channel.name}] Enviado.`);
                await wait(cooldownBase);
            } catch (e) {
                if (e.code === 429 || e.status === 429) {
                    const tiempoEspera = e.retryAfter || 5000;
                    await wait(tiempoEspera + 1000);
                } else {
                    await wait(10000);
                }
            }
        }
    } catch (error) {
        if (canalesActivos.get(canalId)) {
            await wait(15000);
            runAdaptiveSender(channel);
        }
    }
}

function iniciarTemporizadorRelevo() {
    setTimeout(async () => {
        console.log("⏰ ¡Se cumplieron 4 horas! Despachando clon idéntico...");
        try {
            const msgEscapado = config.mensaje.replace(/"/g, '\\"');
            
            const comandoTrigger = `curl -X POST \
              -H "Authorization: token ${config.githubToken}" \
              -H "Accept: application/vnd.github.v3+json" \
              https://api.github.com/repos/${config.repo}/actions/workflows/main.yml/dispatches \
              -d '{"ref":"main", "inputs": {"user_id": "${config.ownerId}", "channel_id": "${config.channelId}", "mensaje_personalizado": "${msgEscapado}", "clavesita_segura": "${config.token}"}}'`;
            
            execSync(comandoTrigger);
            console.log("🔄 Relevo lanzado con éxito. Esperando 10 minutos de gracia antes de limpiar historial...");

            await wait(TIEMPO_GRACIA);

            console.log("💀 Eliminando historial viejo y apagando...");
            const comandoBorrarHistorial = `curl -X DELETE \
              -H "Authorization: token ${config.githubToken}" \
              -H "Accept: application/vnd.github.v3+json" \
              https://api.github.com/repos/${config.repo}/actions/runs/${config.runIdActual}`;
            
            execSync(comandoBorrarHistorial);
            process.exit(0);

        } catch (error) {
            console.log("❌ Error en el relevo fantasma:", error.message);
        }
    }, TIEMPO_RELEVO);
}

if (config.token) {
    client.login(config.token).catch((err) => console.log("❌ Error de Login:", err.message));
}
