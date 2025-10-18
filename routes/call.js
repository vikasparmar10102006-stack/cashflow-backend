import { Router } from "express";

const router = Router();

// --- Socket.io will now handle signaling. The GET /status route is kept for polling fallback. ---

// POST /api/calls/initiate
// This route now emits a signal to the recipient's chat room.
router.post('/initiate', (req, res) => {
    const { chatId, callerId, recipientId } = req.body;
    
    const io = req.app.get('io');
    
    // 🟢 1. EMIT SIGNAL TO THE RECIPIENT'S CHAT ROOM
    io.to(chatId).emit('incomingCall', {
        chatId: chatId,
        callerId: callerId,
        recipientId: recipientId,
    });
    
    console.log(`Call initiated signal emitted for Chat ${chatId}. Caller: ${callerId}`);

    return res.status(200).json({
        success: true,
        message: 'Call signal sent.',
        callStatus: 'calling'
    });
});

// ⚠️ Note: The GET /status route is now redundant for the ChatScreen's main logic
// but is kept here for backward compatibility or as a safety net. 
// In a true real-time app, you would rely purely on sockets.
router.get('/status', (req, res) => {
    // This logic is now managed by the client using the socket.
    return res.status(200).json({
        success: true,
        status: 'idle', // Hardcoded as the logic moved to client/socket signaling
    });
});

// POST /api/calls/accept
// This route now emits a signal back to the caller's chat room to confirm the recipient is joining.
router.post('/accept', (req, res) => {
    const { chatId, userId } = req.body;
    const io = req.app.get('io');

    // 🟢 2. EMIT SIGNAL TO CONFIRM ACCEPTANCE
    io.to(chatId).emit('callAccepted', {
        chatId: chatId,
        acceptorId: userId,
    });
    
    console.log(`User ${userId} accepted call signal emitted for Chat ${chatId}.`);
    
    return res.status(200).json({
        success: true,
        message: 'Call accepted signal sent.',
        callStatus: 'active'
    });
});

// POST /api/calls/end
// This route now emits a signal to both users in the chat room that the call is over.
router.post('/end', (req, res) => {
    const { chatId, userId } = req.body;
    const io = req.app.get('io');

    // 🟢 3. EMIT SIGNAL THAT CALL HAS ENDED
    io.to(chatId).emit('callEnded', {
        chatId: chatId,
        enderId: userId,
    });

    console.log(`Call end signal emitted for Chat ${chatId}.`);
    
    return res.status(200).json({ success: true, message: 'Call ended signal sent.' });
});

export default router;
