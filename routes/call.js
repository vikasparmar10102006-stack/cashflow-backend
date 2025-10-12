import { Router } from "express";

const router = Router();

// --- Temporary in-memory call state store (Replace with MongoDB/Redis in production) ---
const callSessions = {};

// POST /api/calls/initiate
router.post('/initiate', (req, res) => {
    const { chatId, callerId, recipientId } = req.body;

    // Set call status to 'calling' and record the caller
    callSessions[chatId] = {
        status: 'calling', // Status: 'calling'
        callerId: callerId,
        recipientId: recipientId,
        startTime: Date.now(),
    };
    
    // In a real app, you would send a push notification to recipientId here.
    console.log(`Call initiated for Chat ${chatId}. Caller: ${callerId}`);

    return res.status(200).json({
        success: true,
        message: 'Call signal sent.',
        callStatus: 'calling'
    });
});

// GET /api/calls/status
router.get('/status', (req, res) => {
    const { chatId } = req.query;
    const session = callSessions[chatId];
    
    if (session) {
        // Return current call status and caller ID
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

// POST /api/calls/accept
router.post('/accept', (req, res) => {
    const { chatId, userId } = req.body;

    if (callSessions[chatId]) {
        // Update status to 'active' once someone joins
        callSessions[chatId].status = 'active';
        
        // In a real app, you would generate a WebRTC token here.
        
        console.log(`User ${userId} accepted call in Chat ${chatId}.`);
        return res.status(200).json({
            success: true,
            message: 'Call accepted.',
            callStatus: 'active'
        });
    }

    return res.status(404).json({ success: false, message: 'Call session not found.' });
});

// POST /api/calls/end
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
    
    return res.status(200).json({ success: true, message: 'Call already ended.' });
});

export default router;
