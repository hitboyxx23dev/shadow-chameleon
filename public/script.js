const socket = io();

const loginDiv = document.getElementById('login');
const usernameInput = document.getElementById('username-input');
const loginBtn = document.getElementById('login-btn');

const themeSelectDiv = document.getElementById('theme-select');
const themeDropdown = document.getElementById('theme-dropdown');
const startRoundBtn = document.getElementById('start-round-btn');
const customThemeName = document.getElementById('custom-theme-name');
const customThemeWords = document.getElementById('custom-theme-words');
const addCustomThemeBtn = document.getElementById('add-custom-theme-btn');

const gameDiv = document.getElementById('game');
const themeInfo = document.getElementById('theme-info');
const roleInfo = document.getElementById('role-info');
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

const voteContainer = document.getElementById('vote-container');
const voteButtons = document.getElementById('vote-buttons');
const scoreList = document.getElementById('scores');

let role = '';

loginBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if(username){
        loginDiv.style.display = 'none';
        themeSelectDiv.style.display = 'block';
        gameDiv.style.display = 'block';
        socket.emit('set-username', username);
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

// Add custom theme
addCustomThemeBtn.addEventListener('click', () => {
    const name = customThemeName.value.trim();
    const words = customThemeWords.value.split(',').map(w=>w.trim()).filter(w=>w);
    if(name && words.length) {
        socket.emit('add-custom-theme', { name, words });
        customThemeName.value = '';
        customThemeWords.value = '';
    }
});

// Start round with selected theme
startRoundBtn.addEventListener('click', () => {
    const theme = themeDropdown.value;
    socket.emit('start-round-theme', theme);
});

sendBtn.addEventListener('click', () => {
    const msg = chatInput.value.trim();
    if(!msg) return;
    socket.emit('submit-answer', msg);
    chatInput.value = '';
});

socket.on('round-start', data => {
    role = data.role;
    if(role === 'chameleon') roleInfo.textContent = `You are the CHAMELEON! Topic: ${data.topic}`;
    else roleInfo.textContent = `Word: ${data.word} | Topic: ${data.topic}`;
    voteContainer.style.display = 'none';
    chatBox.innerHTML = '';
});

socket.on('chat-message', data => {
    const p = document.createElement('p');
    p.textContent = `${data.username}: ${data.message}`;
    chatBox.appendChild(p);
    chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on('vote-start', data => {
    voteContainer.style.display = 'block';
    voteButtons.innerHTML = '';
    data.players.forEach(p => {
        const btn = document.createElement('button');
        btn.textContent = p.username;
        btn.addEventListener('click', () => {
            socket.emit('vote', p.id);
            voteContainer.style.display = 'none';
        });
        voteButtons.appendChild(btn);
    });
});

socket.on('round-end', data => {
    themeInfo.textContent = `Round Over! Chameleon was ${data.chameleon} | Word: ${data.word}`;
    chatBox.innerHTML = '';
    Object.values(data.answers).forEach(answer => {
        const p = document.createElement('p');
        p.textContent = answer;
        chatBox.appendChild(p);
    });
});

socket.on('update-scores', players => {
    scoreList.innerHTML = '';
    Object.values(players).forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.username}: ${p.score}`;
        scoreList.appendChild(li);
    });
});

// Request theme list on connect
socket.emit('theme-list-request');
