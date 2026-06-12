import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.send({ status: 'ok', uptime: process.uptime() });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // In production, customize this to your client URL
    methods: ['GET', 'POST']
  }
});

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  userId: string;
  type: 'freehand' | 'eraser';
  points: Point[];
  color: string;
  width: number;
}

interface User {
  socketId: string;
  userId: string;
  userName: string;
  color: string;
  cursor?: Point | null;
}

interface Room {
  roomId: string;
  strokes: Stroke[];
  redoStacks: { [userId: string]: Stroke[] };
  users: { [socketId: string]: User };
}

// In-memory state storage
const rooms: { [roomId: string]: Room } = {};

// Helper to assign a random distinct color for user cursors
const USER_COLORS = [
  '#E81123', '#0078D7', '#107C41', '#F7630C', '#800080',
  '#008080', '#D83B01', '#00B7C3', '#B4009E', '#002050'
];
function getRandomColor() {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

io.on('connection', (socket) => {
  let currentRoomId: string | null = null;

  console.log(`Socket connected: ${socket.id}`);

  // Handle user joining a room
  socket.on('join-room', ({ roomId, userId, userName }: { roomId: string; userId: string; userName: string }) => {
    currentRoomId = roomId;
    socket.join(roomId);

    // Initialize room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = {
        roomId,
        strokes: [],
        redoStacks: {},
        users: {}
      };
    }

    const room = rooms[roomId];

    // Create a new user entry
    const userColor = getRandomColor();
    const newUser: User = {
      socketId: socket.id,
      userId,
      userName,
      color: userColor,
      cursor: null
    };

    room.users[socket.id] = newUser;

    // Send initial room data (current stroke history and active users) to the joined user
    socket.emit('room-data', {
      strokes: room.strokes,
      users: Object.values(room.users),
      myColor: userColor
    });

    // Notify other users in the room
    socket.to(roomId).emit('user-joined', newUser);
    console.log(`User ${userName} (${userId}) joined room ${roomId}`);
  });

  // Handle stroke drawn by a user
  socket.on('draw-stroke', (stroke: Stroke) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;

    const room = rooms[currentRoomId];
    room.strokes.push(stroke);

    // Clear redo stack for this user since they did a new action
    if (!room.redoStacks[stroke.userId]) {
      room.redoStacks[stroke.userId] = [];
    }
    room.redoStacks[stroke.userId] = [];

    // Broadcast the new stroke to everyone else in the room
    socket.to(currentRoomId).emit('stroke-added', stroke);
  });

  // Handle real-time segment streaming
  socket.on('draw-segment', (data: { prevPoint: Point; currentPoint: Point; color: string; width: number; type: 'freehand' | 'eraser' }) => {
    if (!currentRoomId) return;
    socket.to(currentRoomId).emit('segment-added', data);
  });

  // Handle undo operation
  socket.on('undo', ({ userId }: { userId: string }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;

    const room = rooms[currentRoomId];

    // Find the last stroke drawn by this user
    let lastIndex = -1;
    for (let i = room.strokes.length - 1; i >= 0; i--) {
      if (room.strokes[i].userId === userId) {
        lastIndex = i;
        break;
      }
    }

    if (lastIndex !== -1) {
      const [undoneStroke] = room.strokes.splice(lastIndex, 1);

      if (!room.redoStacks[userId]) {
        room.redoStacks[userId] = [];
      }
      room.redoStacks[userId].push(undoneStroke);

      // Broadcast updated board to all clients in the room
      io.in(currentRoomId).emit('board-updated', { strokes: room.strokes });
    }
  });

  // Handle redo operation
  socket.on('redo', ({ userId }: { userId: string }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;

    const room = rooms[currentRoomId];
    const userRedoStack = room.redoStacks[userId] || [];

    if (userRedoStack.length > 0) {
      const redoneStroke = userRedoStack.pop();
      if (redoneStroke) {
        room.strokes.push(redoneStroke);
        // Broadcast updated board to all clients in the room
        io.in(currentRoomId).emit('board-updated', { strokes: room.strokes });
      }
    }
  });

  // Handle clear board operation
  socket.on('clear-board', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;

    const room = rooms[currentRoomId];
    room.strokes = [];
    room.redoStacks = {};

    // Broadcast empty board to all clients in the room
    io.in(currentRoomId).emit('board-updated', { strokes: [] });
  });

  // Handle cursor mouse movement
  socket.on('mouse-move', (cursor: Point) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;

    const room = rooms[currentRoomId];
    const user = room.users[socket.id];
    if (user) {
      user.cursor = cursor;
      // Broadcast cursor coordinates to other users in the room
      socket.to(currentRoomId).emit('user-cursor-moved', {
        socketId: socket.id,
        cursor
      });
    }
  });

  // Handle user disconnecting
  socket.on('disconnect', () => {
    if (currentRoomId && rooms[currentRoomId]) {
      const room = rooms[currentRoomId];
      const user = room.users[socket.id];

      if (user) {
        delete room.users[socket.id];
        // Notify other users
        socket.to(currentRoomId).emit('user-left', { socketId: socket.id });
        console.log(`User ${user.userName} left room ${currentRoomId}`);

        // Cleanup empty rooms
        if (Object.keys(room.users).length === 0) {
          delete rooms[currentRoomId];
          console.log(`Room ${currentRoomId} is empty. Cleaned up room state.`);
        }
      }
    }
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 8081;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
