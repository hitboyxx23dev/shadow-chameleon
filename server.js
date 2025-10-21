const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = {}; // {socketId: {username, score}}
let roundActive = false;
let topic = '';
let chameleonId = '';
let answers = {}; // {socketId: answer}
let votes = {}; // {voterId: votedId}

const animeTopics = [
    "Naruto characters",
    "One Piece characters",
    "Attack on Titan",
    "Dragon Ball Z characters",
    "My Hero Academia"
];

function startRound() {
    const ids = Object.keys(players);
    if(ids.length < 3) return; // Need at least 3 players

    topic = animeTopics[Math.floor(Math.random() * animeTopics.length)];
    chameleonId = ids[Math.floor(Math.random() * ids.length)];
    answers = {};
    votes = {};
    roundActive = true;

    ids.forEach(id => {
        if(id === chameleonId) {
            io.to(id).emit('round-start', { role: 'chameleon' });
        } else {
            io.to(id).emit('round-start', { role: 'player', topic });
        }
    });

    io.emit('chat-message', { username: 'SYSTEM', message: `Round started! Topic assigned.` });
}

function endRound() {
    roundActive = false;
    io.emit('round-end', { answers, chameleon: players[chameleonId].username });
}

function tallyVotes() {
    let correctVotes = 0;
    Object.values(votes).forEach(votedId => {
        if(votedId === chameleonId) correctVotes++;
    });

    const ids = Object.keys(players);
    if(correctVotes === 0) {
        // Chameleon survives
        players[chameleonId].score += 2;
    } else {
        // Players get points
        ids.forEach(id => {
            if(id !== chameleonId && votes[id] === chameleonId) {
                players[id].score += 1;
            }
        });
    }

    io.emit('update-scores', players);
    setTimeout(startRound, 5000);
}

io.on('connection', (socket) => {
    console.log(socket.id, 'connected');

    socket.on('set-username', username => {
        players[socket.id] = { username, score: 0 };
        io.emit('player-list', Object.values(players).map(p => p.username));

        if(!roundActive && Object.keys(players).length >= 3) startRound();
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

server.listen(3000, () => console.log('Server running on port 3000'));
