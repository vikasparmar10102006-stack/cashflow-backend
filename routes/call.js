import { Router } from "express";
// ⭐ NEW: Import for Agora Token Generation
import { RtcTokenBuilder, RtcRole } from 'agora-access-token'; 
import dotenv from 'dotenv';

dotenv.config();

// --- Agora Credentials and Configuration ---
const AGORA_APP_ID = process.env.AGORA_APP_ID; // Assuming you have this in .env
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;
// Token validity time (3600 seconds = 1 hour)
const expirationTimeInSeconds = 3600; 

// --- Temporary in-memory call state store (Replace with MongoDB/Redis in production) ---
// Keys are chatId strings, values are call session objects.
const callSessions = {};

const router = Router();

/**
 * GET /api/calls/token?channelName=...&uid=...
 * Generates a valid Agora RTC Token.
 */
router.get('/token', (req, res) => {
    const { channelName, uid } = req.query; // channelName is the chatId

    if (!channelName) {
        return res.status(400).json({ success: false, message: 'channelName is required.' });
    }
    if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
        console.error("AGORA_APP_ID or AGORA_APP_CERTIFICATE missing in .env");
        return res.status(500).json({ success: false, message: 'Server configuration error.' });
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Use RtcRole.PUBLISHER for users who need to send audio (all users in a call)
    const token = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channelName,
        parseInt(uid), // Use the specific UID or 0 from the client
        RtcRole.PUBLISHER,
        privilegeExpiredTs
    );

    return res.status(200).json({ token: token, success: true });
});

/**
 * POST /api/calls/initiate
 * Handles the caller initiating a new call.
 */
router.post('/initiate', (req, res) => {
    const { chatId, callerId, recipientId } = req.body;

    // Check if a call is already active for this chat
    if (callSessions[chatId] && callSessions[chatId].status !== 'idle') {
         return res.status(400).json({
            success: false,
            message: `A call session is already ${callSessions[chatId].status}.`,
        });
    }

    // Set call status to 'calling' (ringing on recipient's end)
    callSessions[chatId] = {
        status: 'calling', 
        callerId: callerId,
        recipientId: recipientId,
        startTime: Date.now(),
    };
    
    console.log(`Call initiated for Chat ${chatId}. Caller: ${callerId}.`);

    return res.status(200).json({
        success: true,
        message: 'Call signal sent.',
        callStatus: 'calling'
    });
});

/**
 * GET /api/calls/status
 * Fetched by the frontend (polling) to check if there is an incoming or active call.
 */
router.get('/status', (req, res) => {
    const { chatId } = req.query;
    const session = callSessions[chatId];
    
    if (session && session.status !== 'idle') {
        // Return current call status and related user IDs
        return res.status(200).json({
            success: true,
            status: session.status,
            callerId: session.callerId,
            recipientId: session.recipientId,
        });
    }

    // Default status if no call is active
    return res.status(200).json({
        success: true,
        status: 'idle',
    });
});

/**
 * POST /api/calls/accept
 * Called by the recipient's phone once their Agora SDK successfully connects (onJoinChannelSuccess).
 */
router.post('/accept', (req, res) => {
    const { chatId, userId } = req.body; // userId is the one who accepted

    if (callSessions[chatId] && callSessions[chatId].status === 'calling') {
        // Update status to 'active' once the second user joins the Agora channel
        callSessions[chatId].status = 'active';
        
        console.log(`User ${userId} accepted call in Chat ${chatId}. Status: Active.`);
        return res.status(200).json({
            success: true,
            message: 'Call accepted.',
            callStatus: 'active'
        });
    }
    
    // If the session is already active or doesn't exist, return success anyway or 404
    if (callSessions[chatId] && callSessions[chatId].status === 'active') {
        return res.status(200).json({ success: true, message: 'Call already active.' });
    }

    return res.status(404).json({ success: false, message: 'Call session not found or already ended.' });
});

/**
 * POST /api/calls/end
 * Called by either user when they hang up.
 */
router.post('/end', (req, res) => {
    const { chatId } = req.body;
    
    if (callSessions[chatId]) {
        // Remove the call session to reset the status to 'idle'
        delete callSessions[chatId];
        console.log(`Call ended for Chat ${chatId}.`);
        return res.status(200).json({
            success: true,
            message: 'Call ended.',
        });
    }
    
    return res.status(200).json({ success: true, message: 'Call already ended or was not active.' });
});

export default router;
