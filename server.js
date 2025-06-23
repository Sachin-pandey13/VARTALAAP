const express = require('express');
const http = require('http');
const multer = require('multer');
const path = require('path');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/upload', upload.single('file'), (req, res) => {
  res.json({
    filename: req.file.filename,
    originalname: req.file.originalname,
    url: `/uploads/${req.file.filename}`
  });
});
const users = {};

io.on('connection', socket => {
  socket.on('new-user', username => {
    users[socket.id] = username;
    socket.username = username; 
    socket.broadcast.emit('user-joined', username);
    io.emit('user-count', io.engine.clientsCount);
  });

  socket.on('send-message', data => {
    io.emit('chat-message', {
      user: socket.username, 
      message: data.message,
      file: data.file || null,
      timestamp: new Date(),
      id: socket.id
    });
  });

  socket.on('typing', status => {
    socket.broadcast.emit('typing', {
      user: socket.username,
      status
    });
  });

  socket.on('react-message', ({ messageId, reaction }) => {
    const user = users[socket.id]; // ✅ Works correctly
    io.emit('message-reaction', { messageId, reaction, user });
  });

  socket.on('edit-message', ({ messageId, newText }) => {
    io.emit('message-edited', { messageId, newText });
  });

  socket.on('delete-message', messageId => {
    io.emit('message-deleted', messageId);
  });

  socket.on('disconnect', () => {
    const username = users[socket.id]; // ✅ Get username before removing
    delete users[socket.id];
    socket.broadcast.emit('user-left', username);
    io.emit('user-count', io.engine.clientsCount);
  });
});
const PORT = process.env.PORT || 8080
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
