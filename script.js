document.addEventListener('DOMContentLoaded', () => {
  // 🔧 Utility: Generate consistent color from username
function getUserColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const r = (hash >> 24) & 0xff;
  const g = (hash >> 16) & 0xff;
  const b = (hash >> 8) & 0xff;
  return `rgba(${Math.abs(r)}, ${Math.abs(g)}, ${Math.abs(b)}, 0.2)`;
}

const socket = io('https://dace534e-6dad-41f3-9b09-dfec9e39bed5.e1-us-east-azure.choreoapps.dev', {
  transports: ['websocket'],
  secure: true
});

let username = '';
const loginScreen = document.getElementById('login-screen');
const chatContainer = document.getElementById('chat-container');
const messageForm = document.getElementById('message-form');
 const messageInput = document.getElementById('message-input'); 
const chatBox = document.getElementById('chat-box');
const typingIndicator = document.getElementById('typing-indicator');
const userCount = document.getElementById('user-count');
const fileInput = document.getElementById('file-input');

document.getElementById('login-btn').onclick = () => {
   console.log('✅ Login button clicked');
  username = document.getElementById('username-input').value.trim();
  if (username) {
    loginScreen.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    socket.emit('new-user', username);
  }
};
document.getElementById('logout-btn').onclick = () => {
  location.reload(); // Simply reload to reset session
};

messageInput.addEventListener('input', () => {
  socket.emit('typing', messageInput.value.length > 0);
});

messageForm.onsubmit = async e => {
  e.preventDefault();
  const message = messageInput.value.trim();
  const file = fileInput.files[0];

  let fileData = null;
  if (file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/upload', {
      method: 'POST',
      body: formData
    });
    fileData = await res.json();
    fileInput.value = ''; // clear
  }

  if (message || fileData) {
    const msgData = {
      message,
      file: fileData
    };
    socket.emit('send-message', msgData);
    appendMessage({ user: 'You', ...msgData, timestamp: new Date(), id: 'self-' + Date.now() }, true);
    messageInput.value = '';
    socket.emit('typing', false);
  }
};

socket.on('chat-message', data => {
  if (data.user === username) return;
  appendMessage(data);
});

socket.on('user-joined', user => {
  if (user !== username) {
    appendSystemMessage(`🟢 ${user} joined the chat`);
  }
});
socket.on('user-left', user => appendSystemMessage(`👋 ${user} has left the chat.`));

socket.on('typing', data => {
  typingIndicator.innerText = data.status ? `${data.user} is typing...` : '';
});
socket.on('user-count', count => {
  userCount.innerText = `Online: ${count}`;
});
socket.on('message-reaction', ({ messageId, reaction, user }) => {
  const msg = document.querySelector(`[data-id="${messageId}"]`);
  if (msg) {
    const span = msg.querySelector('.reactions');
    const r = document.createElement('span');
    r.innerText = `${reaction}`;
    r.title = user;
    span.appendChild(r);
  }
});
socket.on('message-edited', ({ messageId, newText }) => {
  const msg = document.querySelector(`[data-id="${messageId}"] .msg-text`);
  if (msg) msg.innerText = newText + ' (edited)';
});
socket.on('message-deleted', messageId => {
  const msg = document.querySelector(`[data-id="${messageId}"]`);
  if (msg) msg.remove();
});

function getUserStyleClass(username) {
  const hash = [...username].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return `user-message-pulse-${(hash % 5) + 1}`;
}

function getColorHash(username) {
  const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];
  const hash = [...username].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

function appendMessage(data, isOwn = false) {
  const div = document.createElement('div');
  div.className = `message ${isOwn ? 'you' : ''}`;
  div.dataset.id = data.id;

  // 👇 Add pulsing border + animated color background
  div.classList.add(getUserStyleClass(data.user));
  div.classList.add(`bg-${getColorHash(data.user)}`);

  let fileHtml = '';
  if (data.file) {
    if (data.file.originalname.match(/\.(jpg|png|gif|jpeg)$/i)) {
      fileHtml = `<img src="${data.file.url}" class="chat-image" onclick="showImageModal('${data.file.url}')" />`;
    } else {
      fileHtml = `<a href="${data.file.url}" target="_blank">${data.file.originalname}</a>`;
    }
  }

  const mentionSound = data.message?.includes('@' + username);
  if (mentionSound) document.getElementById('mention-sound').play();

  div.innerHTML = `
    <strong>${data.user}</strong>: <span class="msg-text">${data.message}</span>
    ${fileHtml}
    <div class="timestamp">${new Date(data.timestamp).toLocaleTimeString()}</div>
    <div class="reactions" style="margin-top:5px;"></div>
    ${isOwn ? actionButtonsHTML(data.id) : reactionButtonsHTML(data.id)}
  `;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendSystemMessage(msg) {
  const div = document.createElement('div');
  div.className = 'message system';
  div.innerHTML = `<em>${msg}</em> 
  <div class="timestamp system-timestamp">${new Date().toLocaleTimeString()}</div>
  `;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}


function reactionButtonsHTML(id) {
  return `
    <button onclick="react('${id}','👍')">👍</button>
    <button onclick="react('${id}','❤')">❤</button>
    <button onclick="react('${id}','😂')">😂</button>
    <button onclick="react('${id}','🔥')">🔥</button>
  `;
}

function actionButtonsHTML(id) {
  return `
    <button onclick="editMsg('${id}')">✏️</button>
    <button onclick="deleteMsg('${id}')">🗑️</button>
    ${reactionButtonsHTML(id)}
  `;
}

// Global helper functions for reactions/edit/delete
window.react = (id, emoji) => socket.emit('react-message', { messageId: id, reaction: emoji });

window.editMsg = id => {
  const msgElem = document.querySelector(`[data-id="${id}"] .msg-text`);
  if (msgElem) {
    const newText = prompt('Edit message:', msgElem.innerText.replace(' (edited)', ''));
    if (newText !== null && newText.trim()) {
      socket.emit('edit-message', { messageId: id, newText });
    }
  }
};

window.deleteMsg = id => {
  if (confirm('Delete this message?')) {
    socket.emit('delete-message', id);
  }
};

function showImageModal(src) {
  const modal = document.createElement('div');
  modal.className = 'image-modal';
  modal.innerHTML = `
    <div class="image-modal-overlay" onclick="this.parentNode.remove()"></div>
    <img src="${src}" class="image-modal-content" />
  `;
  document.body.appendChild(modal);
}

});
