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
    "Anime Characters": ["Naruto", "Luffy", "Goku", "Deku", "Eren"]
};
let customThemes = {};

// Rooms: store all state per room
let rooms = {};

/**
 * Utility to pick random word from theme
 */
function pickWord(themeName) {
    let words = themes[themeName] || customThemes[themeName] || ["Default"];
    return words[Math.floor(Math.random() * words.length)];
}

/**
 * Shuffle array (for turn order)
 */
function shuffle(array) {
    let a = array.slice();
    for(let i=a.length-1; i>0; i--){
        let j = Math.floor(Math.random()*(i+1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Start the round: assign chameleon, topic, word, turn order
 */
function startRound(roomName, themeName) {
    const room = rooms[roomName];
    if(!room) return;

    const playerIds = Object.keys(room.players);
    if(playerIds.length < 3) {
        io.to(room.leaderId).emit('not-enough-players');
        return;
    }

    const selectedTheme = themeName || Object.keys(themes)[0];
    room.topic = selectedTheme;
    room.word = pickWord(selectedTheme);
    room.chameleonId = playerIds[Math.floor(Math.random()*playerIds.length)];
    room.roundActive = true;
    room.answers = {};
    room.votes = {};
    room.turnOrder = shuffle(playerIds);
    room.currentTurnIndex = 0;
    room.phase = "hint1"; // first hint round

    playerIds.forEach(id => {
        room.answers[id] = [];
        if(id === room.chameleonId)
            io.to(id).emit('round-start', { role: 'chameleon', topic: room.topic });
        else
            io.to(id).emit('round-start', { role: 'player', topic: room.topic, word: room.word });
    });

    io.in(roomName).emit('chat-message', { username:'SYSTEM', message:`Round started! Theme: ${selectedTheme}` });

    startPlayerTurn(roomName);
}

/**
 * Start next player's turn
 */
function startPlayerTurn(roomName) {
    const room = rooms[roomName];
    if(!room) return;

    if(room.currentTurnIndex >= room.turnOrder.length) {
        // All players finished this hint round
        if(room.phase === "hint1") {
            room.phase = "hint2-voting";
            io.in(roomName).emit('chat-message',{username:'SYSTEM', message:'First hint round done! Discuss and vote for second hint round.'});
            io.in(roomName).emit('start-second-hint-vote'); 
        } else if(room.phase === "hint2") {
            room.phase = "discussion";
            io.in(roomName).emit('chat-unlock-all');
            io.in(roomName).emit('chat-message',{username:'SYSTEM', message:'Second hint round done! Discuss freely before final vote.'});
        }
        return;
    }

    const currentPlayerId = room.turnOrder[room.currentTurnIndex];
    io.in(roomName).emit('chat-locked', currentPlayerId);
    io.to(currentPlayerId).emit('your-turn');
}

/**
 * Handle clue submission
 */
function submitClue(roomName, playerId, clue) {
    const room = rooms[roomName];
    if(!room || !room.roundActive) return;
    room.answers[playerId].push(clue);
    room.currentTurnIndex++;
    startPlayerTurn(roomName);
}

/**
 * Handle votes
 */
function tallyVotes(roomName) {
    const room = rooms[roomName];
    if(!room) return;

    let correctVotes = 0;
    Object.values(room.votes).forEach(votedId => {
        if(votedId === room.chameleonId) correctVotes++;
    });

    Object.keys(room.players).forEach(id => {
        if(id === room.chameleonId && correctVotes === 0) room.players[id].score += 2; // Chameleon survives
        else if(room.votes[id] === room.chameleonId) room.players[id].score += 1; // players get points
    });

    io.in(roomName).emit('update-scores', room.players);
    io.in(roomName).emit('round-end',{answers: room.answers, chameleon: room.players[room.chameleonId]?.username, word: room.word});

    room.roundActive = false;
    // Next round automatically after 5s
    setTimeout(()=>startRound(roomName, room.topic),5000);
}

io.on('connection', socket => {
    console.log(socket.id,'connected');

    socket.on('join-room', ({username, roomName}) => {
        if(!rooms[roomName]) rooms[roomName] = { players:{}, leaderId: socket.id, roundActive:false };
        const room = rooms[roomName];

        socket.join(roomName);
        room.players[socket.id] = { username, score:0 };
        if(!room.leaderId) room.leaderId = socket.id;

        io.in(roomName).emit('player-list', Object.values(room.players).map(p=>p.username));
        io.to(socket.id).emit('is-leader', socket.id === room.leaderId);
        socket.emit('theme-list', Object.keys({...themes,...customThemes}));
    });

    socket.on('start-round', ({roomName, themeName})=>{
        const room = rooms[roomName];
        if(!room || socket.id!==room.leaderId) return;
        startRound(roomName, themeName);
    });

    socket.on('submit-clue', ({roomName, clue})=>{
        submitClue(roomName, socket.id, clue);
    });

    socket.on('vote', ({roomName, votedId})=>{
        const room = rooms[roomName];
        if(!room) return;
        room.votes[socket.id] = votedId;

        if(Object.keys(room.votes).length === Object.keys(room.players).length) {
            tallyVotes(roomName);
        }
    });

    socket.on('add-custom-theme', data=>{
        const {name, words} = data;
        if(name && words && words.length>0) customThemes[name]=words;
        socket.emit('theme-list', Object.keys({...themes,...customThemes}));
    });

    socket.on('chat-message', ({roomName,msg})=>{
        const room = rooms[roomName];
        if(!room || !room.players[socket.id]) return;
        io.in(roomName).emit('chat-message',{username: room.players[socket.id].username, message: msg});
    });

    socket.on('disconnect', ()=>{
        for(const roomName in rooms){
            const room = rooms[roomName];
            if(room.players[socket.id]){
                delete room.players[socket.id];
                if(room.leaderId===socket.id) room.leaderId = Object.keys(room.players)[0] || null;
                io.in(roomName).emit('player-list', Object.values(room.players).map(p=>p.username));
            }
        }
    });
});

server.listen(3000,()=>console.log('Server running on http://localhost:3000'));
