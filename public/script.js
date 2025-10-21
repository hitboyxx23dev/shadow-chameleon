const socket = io();

const loginDiv = document.getElementById('login');
const usernameInput = document.getElementById('username-input');
const loginBtn = document.getElementById('login-btn');

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
        gameDiv.style.display = 'block';
        socket.emit('set-username', username);
    }
});

sendBtn.addEventListener('click', () => {
    const msg = chatInput.value.trim();
    if(!msg) return;

    socket.emit('submit-answer', msg);
    chatInput.value = '';
});

socket.on('round-start', data => {
    role = data.role;
    if(role === 'chameleon') {
        roleInfo.textContent = `You are the CHAMELEON! Theme: ${data.theme}`;
    } else {
        roleInfo.textContent = `Topic: ${data.word} | Theme: ${data.theme}`;
    }
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
    chatBox.innerHTML = '';
    themeInfo.textContent = `Round Over! Chameleon was ${data.chameleon}`;
    Object.entries(data.answers).forEach(([id, answer]) => {
        const p = document.createElement('p');
        p.textContent = `${answer}`;
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
