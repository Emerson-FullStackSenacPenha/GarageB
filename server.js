const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new socketIo.Server(server);
const PORT = 3000;

// Configuração para servir arquivos estáticos (HTML, CSS, JS, Imagens)
app.use(express.static(path.join(__dirname)));

// Endpoint para servir o arquivo MP3
// Certifique-se de que o arquivo 'minha_musica.mp3' está na raiz do projeto.
app.get('/audio/stream', (req, res) => {
    const filePath = path.join(__dirname, 'minha_musica.mp3');
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        // Suporte a streaming (range requests)
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'audio/mp3',
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        // Servir o arquivo inteiro (para browsers mais antigos)
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'audio/mp3',
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
    }
});

// Socket.IO para notificar a troca de rádio (simulação de ADM)
io.on('connection', (socket) => {
    console.log('Um usuário se conectou.');

    // Ouve a ação do admin (Atualizar Playlist)
    socket.on('change_channel', (channel) => {
        console.log(`[ADM] Mudou foco para o canal: ${channel}`);
        // Notifica TODOS os clientes (ouvintes) sobre a mudança
        io.emit('new_channel', channel);
    });
    
    // Ouve a ação do admin (Reiniciar Stream)
    socket.on('restart_stream', (channel) => {
        console.log(`[ADM] Reiniciou o stream do canal: ${channel}`);
        // Notifica TODOS os clientes
        io.emit('stream_restarted', channel); 
    });


    socket.on('disconnect', () => {
        console.log('Um usuário se desconectou.');
    });
});

// Inicia o servidor
server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log('Acesse http://localhost:3000/index.html');
});