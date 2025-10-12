import express from 'express'
import AuthRoutes from './routes/auth.js';
import cors from 'cors';
import connectDB from './utils/db.js';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import RequestRoutes from './routes/requests.js';
import CallRoutes from './routes/call.js'; // ⭐ IMPORT NEW CALL ROUTES

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

app.use('/api/auth', AuthRoutes);
app.use('/api/requests', RequestRoutes);
app.use('/api/calls', CallRoutes); // ⭐ REGISTER NEW CALL ROUTES

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
