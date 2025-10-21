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
let currentWord = '';
let chameleonId = '';
let answers = {}; // {socketId: clue/answer}
let votes = {};   // {voterId: votedId}

// Multiple themes
const themes = {
    "Anime": ["Naruto", "One Piece", "Attack on Titan", "Dragon Ball Z", "My Hero Academia"],
    "Games": ["Minecraft", "Fortnite", "Zelda", "Among Us", "Overwatch"],
    "Movies": ["Inception", "Titanic", "Avengers", "The Matrix", "Jurassic Park"]
};

function pickWord(theme) {
    const words = themes[theme] || themes["Anime"];
    return words[Math.floor(Math.random() * words.length)];
}

function startRound() {
    const ids = Object.keys(players);
    if(ids.length < 2) return; // Need at least 2 players

    const themeNames = Object.keys(themes);
    const chosenTheme = themeNames[Math.floor(Math.random() * themeNames.length)];
    currentWord = pickWord(chosenTheme);
    chameleonId = ids[Math.floor(Math.random() * ids.length)];
    answers = {};
    votes = {};
    roundActive = true;

    ids.forEach(id => {
        if(id === chameleonId) {
            io.to(id).emit('round-start', { role: 'chameleon', theme: chosenTheme });
        } else {
            io.to(id).emit('round-start', { role: 'player', word: currentWord, theme: chosenTheme });
        }
    });

    io.emit('chat-message', { username: 'SYSTEM', message: `Round started! Theme: ${chosenTheme}` });
}

function endRound() {
    roundActive = false;
    io.emit('round-end', { answers, chameleon: players[chameleonId]?.username || 'Unknown' });
}

function tallyVotes() {
    let correctVotes = 0;
    Object.values(votes).forEach(votedId => {
        if(votedId === chameleonId) correctVotes++;
    });

    Object.keys(players).forEach(id => {
        if(id === chameleonId && correctVotes === 0) players[id].score += 2; // Chameleon survives
        else if(votes[id] === chameleonId) players[id].score += 1;           // Players get point
    });

    io.emit('update-scores', players);
    setTimeout(startRound, 5000); // Next round
}

io.on('connection', socket => {
    console.log(socket.id, 'connected');

    socket.on('set-username', username => {
        players[socket.id] = { username, score: 0 };
        io.emit('player-list', Object.values(players).map(p => p.username));

        if(!roundActive && Object.keys(players).length >= 2) startRound();
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
        if(players[socket.id]) {
            io.emit('chat-message', { username: players[socket.id].username, message: msg });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('player-list', Object.values(players).map(p => p.username));
    });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));
