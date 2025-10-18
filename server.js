import express from 'express'
import AuthRoutes from './routes/auth.js';
import cors from 'cors';
import connectDB from './utils/db.js';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import RequestRoutes from './routes/requests.js';
import CallRoutes from './routes/call.js';
// 🟢 NEW IMPORTS FOR SOCKET.IO
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();
connectDB();

const app = express()
// 🟢 1. CREATE HTTP SERVER
const httpServer = createServer(app); 

// 🟢 2. INITIALIZE SOCKET.IO SERVER
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all origins for the mobile app
        methods: ["GET", "POST"]
    }
});

// 🟢 3. SOCKET.IO CONNECTION HANDLER
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join a room based on the user's ID for personalized notifications (e.g., incoming request)
    socket.on('joinUserRoom', (userId) => {
        socket.join(userId);
        console.log(`User ${socket.id} joined room: ${userId}`);
    });

    // Join a room based on the chat ID for real-time chat messages and call signals
    socket.on('joinChatRoom', (chatId) => {
        socket.join(chatId);
        console.log(`User ${socket.id} joined chat: ${chatId}`);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// 🟢 4. PASS SOCKET.IO INSTANCE TO ROUTES (for call/chat events)
app.set('io', io);

app.use(cors({origin: '*'}));
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.send('Express server is running!');
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() });
});

app.use('/api/auth', AuthRoutes);
app.use('/api/requests', RequestRoutes);
app.use('/api/calls', CallRoutes);

// 🟢 5. LISTEN ON HTTP SERVER (instead of express app)
httpServer.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT} with WebSockets`);
});
