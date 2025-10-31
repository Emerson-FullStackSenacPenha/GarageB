const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3000;

// --- VARIÁVEIS DE ESTADO DO SERVIDOR ---
// O arquivo MP3 DEVE existir na pasta GarageB (ex: musica_01.mp3)
let currentSong = 'musica_01.mp3'; 
let currentChannel = 'casa';

// Configuração para servir arquivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// --- Rota Principal (Redirecionamento) ---
app.get('/', (req, res) => {
    res.redirect('/index.html');
});

// --- Rota de Streaming de Áudio (COMPLETA E OTIMIZADA PARA MOBILE) ---
app.get('/audio/stream', (req, res) => {
    
    const filePath = path.join(__dirname, currentSong);

    fs.stat(filePath, (err, stat) => {
        if (err) {
            console.error(`ERRO: Arquivo de música não encontrado: ${currentSong}`, err.message);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end(`Música não encontrada no servidor: ${currentSong}`);
            return;
        }

        const fileSize = stat.size;
        
        // Cabeçalhos para streaming e, CRÍTICO, para evitar cache em dispositivos móveis
        res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': fileSize,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        // Cria e conecta o stream de leitura
        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);

        // TRATAMENTO DE ERROS PARA ESTABILIDADE DO STREAM
        readStream.on('error', (streamErr) => {
            console.error(`Erro no stream de ${currentSong} para um cliente:`, streamErr.message);
            readStream.destroy();
            res.end();
        });
        
        // Garante que o stream é destruído quando o cliente fecha a conexão
        req.on('close', () => {
            readStream.destroy();
            console.log('Cliente desconectou do stream. Stream de leitura destruído.');
        });
        
        readStream.on('end', () => {
            console.log(`Transmissão completa de ${currentSong}.`);
        });
    });
});


// --- Lógica Socket.IO ---
io.on('connection', (socket) => {
    console.log('Um novo ouvinte/admin se conectou.');

    // Envia o estado inicial ao novo cliente
    socket.emit('initial_state', { song: currentSong, channel: currentChannel });

    // 1. Comando do Admin: Trocar de Música
    socket.on('change_song', (newSong) => {
        currentSong = newSong;
        console.log(`Música alterada para: ${currentSong}`);
        // Notifica todos os ouvintes sobre a troca
        io.emit('song_changed', currentSong);
    });

    // 2. Comando do Admin: Sincronizar (força posição no player)
    socket.on('sync_request', (syncTime) => {
        console.log(`Comando de sincronia forçada para: ${syncTime} segundos.`);
        io.emit('force_sync', syncTime);
    });

    // 3. Comando do Admin: Trocar de Canal (Foco)
    socket.on('change_channel', (channel) => {
        currentChannel = channel;
        console.log(`Foco da rádio alterado para: ${currentChannel}`);
        io.emit('new_channel', currentChannel);
    });
    
    // 4. Comando do Admin: Play/Pause Remoto
    socket.on('remote_playback_control', (action) => {
        console.log(`Comando de Playback Remoto: ${action}`);
        io.emit('remote_playback_control', action);
    });
    
    // 5. Comando do Admin: Reiniciar Stream (Forçar recarga)
    socket.on('restart_stream', (channel) => {
        console.log(`Comando de Reiniciar Stream no canal: ${channel}`);
        io.emit('stream_restarted', channel);
    });

    socket.on('disconnect', () => {
        console.log('Um cliente se desconectou.');
    });
});


// --- Inicialização do Servidor ---
server.listen(PORT, () => {
    console.log('--------------------------------------------------');
    console.log(`Servidor Node.js (GarageB Rádio) rodando!`);
    console.log(`Acesse o site em: http://localhost:${PORT}/index.html`);
    console.log(`Música atual no servidor: ${currentSong}`);
    console.log('--------------------------------------------------');
});