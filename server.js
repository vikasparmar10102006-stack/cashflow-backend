import express from 'express'
import AuthRoutes from './routes/auth.js';
import cors from 'cors';
import connectDB from './utils/db.js';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import RequestRoutes from './routes/requests.js';
import { keepAlive } from './controllers/auth.js'; // Import the new controller

dotenv.config();
connectDB();

const app = express()

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

// ✅ NEW: Endpoint to hit for keeping the server warm and the DB connection alive
app.get('/health-check', keepAlive);

app.use('/api/auth', AuthRoutes);
app.use('/api/requests', RequestRoutes);

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
