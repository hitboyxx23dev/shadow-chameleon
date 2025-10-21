const socket = io();

const loginDiv = document.getElementById('login');
const usernameInput = document.getElementById('username-input');
const loginBtn = document.getElementById('login-btn');

const gameDiv = document.getElementById('game');
const topicText = document.getElementById('topic');
const roleInfo = document.getElementById('role-info');
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

const voteContainer = document.getElementById('vote-container');
const voteButtons = document.getElementById('vote-buttons');
const scoreList = document.getElementById('scores');

let role = '';
let playerId = '';

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
    if(role === 'chameleon' || role === 'player') {
        socket.emit('submit-answer', msg);
        chatInput.value = '';
    } else {
        socket.emit('chat-message', msg);
        chatInput.value = '';
    }
});

socket.on('round-start', data => {
    role = data.role;
    if(role === 'chameleon') roleInfo.textContent = "You are the CHAMELEON! Blend in!";
    else roleInfo.textContent = `Topic: ${data.topic}`;
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
    topicText.textContent = `Round Over! Chameleon was ${data.chameleon}`;
});

socket.on('update-scores', players => {
    scoreList.innerHTML = '';
    Object.values(players).forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.username}: ${p.score}`;
        scoreList.appendChild(li);
    });
});
