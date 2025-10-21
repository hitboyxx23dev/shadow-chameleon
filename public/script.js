const socket = io();

// Login elements
const loginDiv = document.getElementById('login');
const usernameInput = document.getElementById('username-input');
const roomInput = document.getElementById('room-input');
const loginBtn = document.getElementById('login-btn');

// Theme selection elements
const themeSelectDiv = document.getElementById('theme-select');
const themeDropdown = document.getElementById('theme-dropdown');
const startRoundBtn = document.getElementById('start-round-btn');
const customThemeName = document.getElementById('custom-theme-name');
const customThemeWords = document.getElementById('custom-theme-words');
const addCustomThemeBtn = document.getElementById('add-custom-theme-btn');

// Game elements
const gameDiv = document.getElementById('game');
const themeInfo = document.getElementById('theme-info');
const roleInfo = document.getElementById('role-info');
const leaderInfo = document.getElementById('leader-info');
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const voteContainer = document.getElementById('vote-container');
const voteButtons = document.getElementById('vote-buttons');
const scoreList = document.getElementById('scores');

let role = '';
let roomName = '';
let isLeader = false;

// Join room
loginBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    roomName = roomInput.value.trim();
    if(username && roomName){
        loginDiv.style.display = 'none';
        themeSelectDiv.style.display = 'block';
        gameDiv.style.display = 'block';
        socket.emit('join-room', { username, roomName });
    }
});

// Populate themes
socket.on('theme-list', themes => {
    themeDropdown.innerHTML = '';
    themes.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        themeDropdown.appendChild(opt);
    });
});

// Leader check
socket.on('is-leader', flag => {
    isLeader = flag;
    leaderInfo.textContent = isLeader ? 'You are the Leader' : '';
    startRoundBtn.disabled = !isLeader;
});

// Add custom theme
addCustomThemeBtn.addEventListener('click', () => {
    const name = customThemeName.value.trim();
    const words = customThemeWords.value.split(',').map(w => w.trim()).filter(w => w);
    if(name && words.length) {
        socket.emit('add-custom-theme', { name, words });
        customThemeName.value = '';
        customThemeWords.value = '';
    }
});

// Start round (leader only)
startRoundBtn.addEventListener('click', () => {
    if(!isLeader) return;
    const theme = themeDropdown.value;
    socket.emit('start-round', { roomName, themeName: theme });
});

// Send clue or chat
sendBtn.addEventListener('click', () => {
    const msg = chatInput.value.trim();
    if(!msg) return;
    socket.emit('chat-message', { roomName, msg });
    socket.emit('submit-clue', { roomName, clue: msg });
    chatInput.value = '';
    chatInput.disabled = true; // lock until next turn
});

// Round start
socket.on('round-start', data => {
    role = data.role;
    if(role === 'chameleon') roleInfo.textContent = `You are the CHAMELEON! Topic: ${data.topic}`;
    else roleInfo.textContent = `Word: ${data.word} | Topic: ${data.topic}`;
    voteContainer.style.display = 'none';
    chatBox.innerHTML = '';
});

// Lock chat for turns
socket.on('chat-locked', currentPlayerId => {
    chatInput.disabled = socket.id !== currentPlayerId;
    chatInput.placeholder = socket.id === currentPlayerId ? 'Your turn to give a clue!' : 'Waiting for other player...';
});

// Unlock chat for your turn
socket.on('your-turn', () => {
    chatInput.disabled = false;
    chatInput.placeholder = 'Your turn to give a clue!';
});

// Unlock chat for all (discussion)
socket.on('chat-unlock-all', () => {
    chatInput.disabled = false;
    chatInput.placeholder = 'Discussion phase! Chat freely.';
});

// Voting for second hint round
socket.on('start-second-hint-vote', () => {
    alert('First hint round done! Vote for second hint round or discuss.');
});

// Chat messages
socket.on('chat-message', data => {
    const p = document.createElement('p');
    p.textContent = `${data.username}: ${data.message}`;
    chatBox.appendChild(p);
    chatBox.scrollTop = chatBox.scrollHeight;
});

// Vote buttons
socket.on('vote-start', data => {
    voteContainer.style.display = 'block';
    voteButtons.innerHTML = '';
    data.players.forEach(p => {
        const btn = document.createElement('button');
        btn.textContent = p.username;
        btn.addEventListener('click', () => {
            socket.emit('vote', { roomName, votedId: p.id });
            voteContainer.style.display = 'none';
        });
        voteButtons.appendChild(btn);
    });
});

// Round end
socket.on('round-end', data => {
    themeInfo.textContent = `Round Over! Chameleon: ${data.chameleon} | Word: ${data.word}`;
    chatBox.innerHTML = '';
    Object.entries(data.answers).forEach(([id, clues]) => {
        const p = document.createElement('p');
        p.textContent = `${clues.join(', ')}`;
        chatBox.appendChild(p);
    });
});

// Update scores
socket.on('update-scores', players => {
    scoreList.innerHTML = '';
    Object.values(players).forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.username}: ${p.score}`;
        scoreList.appendChild(li);
    });
});

// Not enough players
socket.on('not-enough-players', () => {
    alert('Not enough players to start the game (minimum 3)');
});

// Update player list
socket.on('player-list', players => {
    // Optionally display player list
});
