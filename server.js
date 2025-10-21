const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let players = {}; // {socketId: {username, score}}
let roundActive = false;
let currentTopic = '';
let currentWord = '';
let chameleonId = '';
let answers = {};
let votes = {};

// Default themes
let themes = {
    "Anime": ["Naruto", "Luffy", "Goku", "Deku", "Eren"],
    "Games": ["Minecraft", "Fortnite", "Zelda", "Among Us", "Overwatch"],
    "Movies": ["Inception", "Titanic", "Avengers", "Matrix", "Jurassic Park"]
};

// Store custom themes added by users
let customThemes = {};

function pickWord(themeName) {
    let words = themes[themeName] || customThemes[themeName] || ["Default"];
    return words[Math.floor(Math.random() * words.length)];
}

function startRound(themeName) {
    const ids = Object.keys(players);
    if(ids.length < 2) return; // minimum 2 players

    const selectedTheme = themeName || Object.keys(themes)[Math.floor(Math.random() * Object.keys(themes).length)];
    currentTopic = selectedTheme;
    currentWord = pickWord(selectedTheme);
    chameleonId = ids[Math.floor(Math.random() * ids.length)];
    answers = {};
    votes = {};
    roundActive = true;

    ids.forEach(id => {
        if(id === chameleonId) {
            io.to(id).emit('round-start', { role: 'chameleon', topic: currentTopic });
        } else {
            io.to(id).emit('round-start', { role: 'player', topic: currentTopic, word: currentWord });
        }
    });

    io.emit('chat-message', { username: 'SYSTEM', message: `Round started! Theme: ${selectedTheme}` });
}

function endRound() {
    roundActive = false;
    io.emit('round-end', { answers, chameleon: players[chameleonId]?.username || 'Unknown', word: currentWord });
}

function tallyVotes() {
    let correctVotes = 0;
    Object.values(votes).forEach(votedId => {
        if(votedId === chameleonId) correctVotes++;
    });

    Object.keys(players).forEach(id => {
        if(id === chameleonId && correctVotes === 0) players[id].score += 2; // Chameleon survives
        else if(votes[id] === chameleonId) players[id].score += 1;           // Players get points
    });

    io.emit('update-scores', players);
    setTimeout(() => startRound(currentTopic), 5000); // next round with same theme
}

io.on('connection', socket => {
    console.log(socket.id, 'connected');

    socket.on('set-username', username => {
        players[socket.id] = { username, score: 0 };
        io.emit('player-list', Object.values(players).map(p => p.username));
    });

    socket.on('submit-answer', answer => {
        if(!roundActive) return;
        answers[socket.id] = answer;

        if(Object.keys(answers).length === Object.keys(players).length) {
            io.emit('chat-message', { username: 'SYSTEM', message: 'All answers submitted! Vote for the Chameleon.' });
            io.emit('vote-start', { players: Object.entries(players).map(([id, p]) => ({id, username: p.username})) });
        }
    });

    socket.on('vote', votedId => {
        votes[socket.id] = votedId;
        if(Object.keys(votes).length === Object.keys(players).length) {
            tallyVotes();
            endRound();
        }
    });

    socket.on('chat-message', msg => {
        if(players[socket.id]) io.emit('chat-message', { username: players[socket.id].username, message: msg });
    });

    socket.on('add-custom-theme', data => {
        const { name, words } = data;
        if(name && words && words.length > 0) {
            customThemes[name] = words;
            io.emit('theme-list', Object.keys({...themes, ...customThemes}));
        }
    });

    socket.on('start-round-theme', themeName => {
        if(!roundActive) startRound(themeName);
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('player-list', Object.values(players).map(p => p.username));
    });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));
