import express from 'express'
import AuthRoutes from './routes/auth.js';
import cors from 'cors';
import connectDB from './utils/db.js';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import RequestRoutes from './routes/requests.js';
// NEW: Import mongoose to check DB connection status for health check
import mongoose from 'mongoose';

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

// ✅ REFINED HEALTH CHECK: Added database status check
app.get('/health', (req, res) => {
    const isDbConnected = mongoose.connection.readyState === 1; // 1 means connected
    
    // If the database is connected, return a 200 OK status
    if (isDbConnected) {
        return res.status(200).json({ 
            status: "ok", 
            uptime: process.uptime(),
            db: "connected",
            message: "Service and database are running smoothly."
        });
    } else {
        // If the database is not connected, return a 503 Service Unavailable status
        return res.status(503).json({ 
            status: "error", 
            db: "disconnected",
            message: "Service is running but database connection failed."
        });
    }
});

app.use('/api/auth', AuthRoutes);
app.use('/api/requests', RequestRoutes);

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
