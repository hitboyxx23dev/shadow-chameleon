const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Default themes
let themes = {
    "Anime": ["Naruto", "Luffy", "Goku", "Deku", "Eren"],
    "Games": ["Minecraft", "Fortnite", "Zelda", "Among Us", "Overwatch"],
    "Movies": ["Inception", "Titanic", "Avengers", "Matrix", "Jurassic Park"]
};

let customThemes = {};

// Rooms: { roomName: { players: {socketId: {username, score}}, leaderId, roundActive, topic, word, chameleonId, answers, votes } }
let rooms = {};

function pickWord(themeName) {
    let words = themes[themeName] || customThemes[themeName] || ["Default"];
    return words[Math.floor(Math.random() * words.length)];
}

function startRound(roomName, themeName) {
    const room = rooms[roomName];
    if(!room) return;

    const playerIds = Object.keys(room.players);
    if(playerIds.length < 3) {
        io.to(room.leaderId).emit('not-enough-players');
        return;
    }

    const selectedTheme = themeName || Object.keys(themes)[Math.floor(Math.random()*Object.keys(themes).length)];
    room.topic = selectedTheme;
    room.word = pickWord(selectedTheme);
    room.chameleonId = playerIds[Math.floor(Math.random()*playerIds.length)];
    room.answers = {};
    room.votes = {};
    room.roundActive = true;

    playerIds.forEach(id => {
        if(id === room.chameleonId)
            io.to(id).emit('round-start', { role: 'chameleon', topic: room.topic });
        else
            io.to(id).emit('round-start', { role: 'player', topic: room.topic, word: room.word });
    });

    io.in(roomName).emit('chat-message', { username: 'SYSTEM', message: `Round started! Theme: ${selectedTheme}` });
}

function endRound(roomName) {
    const room = rooms[roomName];
    if(!room) return;

    room.roundActive = false;
    io.in(roomName).emit('round-end', {
        answers: room.answers,
        chameleon: room.players[room.chameleonId]?.username,
        word: room.word
    });
}

function tallyVotes(roomName) {
    const room = rooms[roomName];
    if(!room) return;

    let correctVotes = 0;
    Object.values(room.votes).forEach(votedId => {
        if(votedId === room.chameleonId) correctVotes++;
    });

    Object.keys(room.players).forEach(id => {
        if(id === room.chameleonId && correctVotes === 0) room.players[id].score += 2;
        else if(room.votes[id] === room.chameleonId) room.players[id].score += 1;
    });

    io.in(roomName).emit('update-scores', room.players);
    // Next round automatically after 5 seconds
    setTimeout(() => startRound(roomName, room.topic), 5000);
}

io.on('connection', socket => {
    console.log(socket.id, 'connected');

    socket.on('join-room', ({ username, roomName }) => {
        if(!rooms[roomName]) rooms[roomName] = { players: {}, leaderId: socket.id, roundActive: false };
        const room = rooms[roomName];

        socket.join(roomName);
        room.players[socket.id] = { username, score: 0 };
        if(!room.leaderId) room.leaderId = socket.id;

        io.in(roomName).emit('player-list', Object.values(room.players).map(p => p.username));
        io.to(socket.id).emit('is-leader', socket.id === room.leaderId);

        // Send theme list
        socket.emit('theme-list', Object.keys({...themes, ...customThemes}));
    });

    socket.on('start-round', ({ roomName, themeName }) => {
        const room = rooms[roomName];
        if(!room) return;
        if(socket.id !== room.leaderId) return; // Only leader can start
        startRound(roomName, themeName);
    });

    socket.on('submit-answer', ({ roomName, answer }) => {
        const room = rooms[roomName];
        if(!room || !room.roundActive) return;
        room.answers[socket.id] = answer;

        if(Object.keys(room.answers).length === Object.keys(room.players).length) {
            io.in(roomName).emit('chat-message', { username:'SYSTEM', message: 'All answers submitted! Vote for the Chameleon.' });
            io.in(roomName).emit('vote-start', { players: Object.entries(room.players).map(([id, p]) => ({id, username: p.username})) });
        }
    });

    socket.on('vote', ({ roomName, votedId }) => {
        const room = rooms[roomName];
        if(!room) return;
        room.votes[socket.id] = votedId;

        if(Object.keys(room.votes).length === Object.keys(room.players).length) {
            tallyVotes(roomName);
            endRound(roomName);
        }
    });

    socket.on('add-custom-theme', data => {
        const { name, words } = data;
        if(name && words && words.length>0) {
            customThemes[name] = words;
        }
    });

    socket.on('chat-message', ({ roomName, msg }) => {
        const room = rooms[roomName];
        if(!room || !room.players[socket.id]) return;
        io.in(roomName).emit('chat-message', { username: room.players[socket.id].username, message: msg });
    });

    socket.on('disconnect', () => {
        for(const roomName in rooms) {
            const room = rooms[roomName];
            if(room.players[socket.id]) {
                delete room.players[socket.id];
                if(room.leaderId === socket.id) room.leaderId = Object.keys(room.players)[0] || null;
                io.in(roomName).emit('player-list', Object.values(room.players).map(p => p.username));
            }
        }
    });
});

server.listen(3000, ()=>console.log('Server running on http://localhost:3000'));
