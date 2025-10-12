import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import Chat from '../models/chat.js';
import dotenv from 'dotenv';
import { getDistance } from 'geolib';
import mongoose from 'mongoose';
import initializeFirebaseAdmin from '../firebaseAdmin.js';
import admin from 'firebase-admin';

dotenv.config();
initializeFirebaseAdmin();

const calculateDistance = (loc1, loc2) => {
    if (!loc1 || !loc2) return Infinity;
    // Use optional chaining for robustness, though schema defines structure
    const lat1 = loc1.latitude || 0;
    const lon1 = loc1.longitude || 0;
    const lat2 = loc2.latitude || 0;
    const lon2 = loc2.longitude || 0;

    return getDistance(
        { latitude: lat1, longitude: lon1 },
        { latitude: lat2, longitude: lon2 } 
    );
};

// Function to send FCM notification to a list of tokens
const sendFCMNotification = async (tokens, data, notification) => {
    if (!tokens || tokens.length === 0) return;
    
    // Filter out null/undefined tokens
    const validTokens = tokens.filter(token => !!token);

    if (validTokens.length === 0) return;

    try {
        const response = await admin.messaging().sendEachForMulticast({ tokens: validTokens, data, notification });
        console.log('Successfully sent multicast FCM message:', response.successCount, 'successes,', response.failureCount, 'failures');
        return response;
    } catch (error) {
        console.error('Error sending multicast FCM message:', error);
    }
};

// ✅ NEW: Keep Alive Controller Function
export const keepAlive = async (req, res) => {
    try {
        // Perform a very fast, lightweight query to keep the database connection warm.
        await User.findOne({}).limit(1).exec(); 
        console.log('Keep-Alive check successful. Server and DB connection are warm.');
        return res.status(200).json({ success: true, message: "Server is awake and connection is warm." });
    } catch (error) {
        console.error('Error in keepAlive/health-check:', error);
        // Respond with success even if the DB check fails, to keep the keep-alive service running.
        return res.status(200).json({ success: true, message: "Server is awake, but DB check failed." });
    }
};

// Full fixed version of authGoogle function — ensures new users get location updated properly
export const authGoogle = async (req, res) => {
    try {
        const { userdata, notificationPermission, locationPermission, location, pushNotificationToken } = req.body;
        
        console.log("Received /api/auth/google request body:", JSON.stringify(req.body, null, 2));

        // Simplified user payload extraction
        let userPayload = null;
        if (userdata?.data?.user) userPayload = userdata.data.user;
        else if (userdata?.user) userPayload = userdata.user;
        else if (userdata?.email) userPayload = userdata;
        

        if (!userPayload || !userPayload.email) {
            console.error("Validation Error: Could not extract user info or email from 'userdata'.");
            return res.status(400).json({ success: false, message: "Invalid user data structure received." });
        }
        
        const { email, name, givenName, familyName, photo: picture } = userPayload;

        // 1. Define fields to be set (scalar updates)
        const setFields = {
            name,
            givenName,
            familyName,
            picture,
            notificationPermission,
            locationPermission,
            // Only update pushToken if it is provided
            ...(pushNotificationToken && { pushNotificationToken }), 
        };

        // 2. Define the full update query object
        const updateQuery = { $set: setFields };

        if (location?.latitude && location?.longitude) {
            // Add $push operator for locationHistory
            updateQuery.$push = {
                locationHistory: {
                    $each: [{ ...location, timestamp: new Date() }],
                    $position: 0,
                    $slice: 5,
                },
            };

            // Also update the dedicated currentLocation field via $set
            updateQuery.$set.currentLocation = {
                latitude: location.latitude,
                longitude: location.longitude,
                timestamp: new Date(),
                accuracy: location.accuracy,
            };
        }
        
        // Use findOneAndUpdate with the complete updateQuery object
        const updatedUser = await User.findOneAndUpdate(
            { email: email }, 
            updateQuery, 
            { new: true, upsert: true, runValidators: true }
        );

        return res.status(updatedUser.isNew ? 201 : 200).json({
            success: true,
            message: `User ${updatedUser.isNew ? 'created' : 'updated'} successfully`,
            user: updatedUser
        });

    } catch (error) {
        console.error('Error in authGoogle controller:', error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const sendCashRequest = async (req, res) => {
    try {
        const { requesterEmail, amount, radius, tip, instructions, requestType, requesterLocation } = req.body;
        const requester = await User.findOne({ email: requesterEmail });
        if (!requester) return res.status(400).json({ success: false, message: "Requester not found." });
        
        const newRequest = {
            _id: new mongoose.Types.ObjectId(),
            requesterId: requester._id,
            requesterName: requester.name,
            amount: parseFloat(amount),
            tip: tip ? parseFloat(tip) : 0,
            instructions, type: requestType,
            status: 'pending', createdAt: new Date(),
        };

        // 1. Find all potential nearby users (everyone except the requester)
        const nearbyUsers = await User.find({
            _id: { $ne: requester._id },
            // Only consider users who have location enabled and a token
            locationPermission: 'granted',
            pushNotificationToken: { $exists: true, $ne: null } 
        });

        const radiusInMeters = radius * 1000;
        
        const recipients = nearbyUsers.filter(user => {
            // ⭐ ROBUST LOCATION CHECK: Prioritizes the dedicated currentLocation field.
            const userLocation = user.currentLocation || (user.locationHistory && user.locationHistory.length > 0 ? user.locationHistory[0] : null);
            
            if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
                return false; // Skip users who have no valid location data
            }

            return calculateDistance(requesterLocation, userLocation) <= radiusInMeters;
        });
        
        const recipientIds = recipients.map(user => user._id);
        
        if (recipientIds.length > 0) {
            // Update the incoming requests list for all recipients
            await User.updateMany(
                { _id: { $in: recipientIds } },
                { $push: { incomingRequests: { $each: [newRequest], $position: 0 } } }
            );

            // 2. Send push notifications to all recipients
            const tokens = recipients.map(user => user.pushNotificationToken);
            const data = {
                type: 'NEW_REQUEST',
                requestId: newRequest._id.toString(),
                requestType: newRequest.type,
                amount: newRequest.amount.toString(),
                requesterId: requester._id.toString(),
                requesterName: requester.name,
            };
            const notification = {
                title: `New ${newRequest.type} Request Near You!`,
                body: `${requester.name} needs ₹${newRequest.amount}. Tip offered: ₹${newRequest.tip}. Tap to respond.`,
            };
            
            await sendFCMNotification(tokens, data, notification);
        }

        await User.findByIdAndUpdate(requester._id, {
            $push: { sentRequests: { $each: [newRequest], $position: 0 } }
        });

        return res.status(200).json({ success: true, message: "Request sent.", requestId: newRequest._id });
    } catch (error) {
        console.error('Error in sendCashRequest:', error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// --- REWRITTEN LOGIC FOR `updateRequestStatus` ---
export const updateRequestStatus = async (req, res) => {
    try {
        const { userEmail, requestId, newStatus } = req.body;
        if (newStatus !== 'accepted') {
            return res.status(400).json({ success: false, message: "Only 'accepted' status is handled." });
        }

        const acceptor = await User.findOne({ email: userEmail, "incomingRequests._id": requestId });
        if (!acceptor) return res.status(404).json({ success: false, message: "Acceptor or request not found." });

        const requestInAcceptor = acceptor.incomingRequests.find(r => r._id.toString() === requestId);
        if (requestInAcceptor.status !== 'pending') {
             return res.status(400).json({ success: false, message: `Request already has status: ${requestInAcceptor.status}.` });
        }
        
        const requester = await User.findById(requestInAcceptor.requesterId);
        if (!requester) return res.status(404).json({ success: false, message: "Original requester not found." });

        // 1. Create a new, private chat for this interaction
        const newChat = await Chat.create({ participants: [acceptor._id, requester._id] });
        const chatId = newChat._id.toString();

        // 2. Mark the request as 'accepted' for the acceptor
        await User.updateOne(
            { _id: acceptor._id, "incomingRequests._id": requestId },
            { $set: { "incomingRequests.$.status": "accepted", "incomingRequests.$.chatId": chatId } }
        );

        // 3. Add the acceptor to the requester's list of acceptors for that sent request
        const newAcceptorInfo = {
            acceptorId: acceptor._id,
            acceptorName: acceptor.name,
            chatId: chatId,
        };

        await User.updateOne(
            { _id: requester._id, "sentRequests._id": requestId },
            { 
                $push: { "sentRequests.$.acceptors": newAcceptorInfo },
                // Also update the status to 'active' to show it has responses
                $set: { "sentRequests.$.status": "active" } 
            }
        );
        
        // 4. Send a push notification to the requester
        if (requester.pushNotificationToken) {
            const message = {
                token: requester.pushNotificationToken,
                data: {
                    type: 'REQUEST_ACCEPTED_BY_USER', // New type for this specific event
                    requestId, chatId,
                    acceptorId: acceptor._id.toString(),
                    acceptorName: acceptor.name,
                    title: 'New Offer!',
                    body: `${acceptor.name} has accepted your request for ₹${requestInAcceptor.amount}.`
                },
                notification: {
                    title: 'New Offer Received',
                    body: `${acceptor.name} has offered to fulfill your request for ₹${requestInAcceptor.amount}. Tap to view offers.`,
                },
            };
            await admin.messaging().send(message);
            console.log('Successfully sent new acceptor notification to:', requester.email);
        }

        return res.status(200).json({ success: true, message: "Request accepted. You can now chat.", chatId });

    } catch (error) {
        console.error('Error in updateRequestStatus:', error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// --- Other functions (getNotifications, getSentRequests, etc.) remain the same ---

export const getRequestAcceptors = async (req, res) => {
    try {
        const { userEmail, requestId } = req.query;
        const user = await User.findOne({ email: userEmail });
        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        const sentRequest = user.sentRequests.find(req => req._id.toString() === requestId);
        if (!sentRequest) return res.status(404).json({ success: false, message: "Request not found." });

        return res.status(200).json({ success: true, acceptors: sentRequest.acceptors || [] });

    } catch (error) {
        console.error('Error in getRequestAcceptors:', error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getNotifications = async (req, res) => {
    try {
        const { userEmail } = req.query;
        const user = await User.findOne({ email: userEmail });
        if (!user) return res.status(404).json({ success: false, message: "User not found." });
        return res.status(200).json({ success: true, notifications: user.incomingRequests });
    } catch (error) {
        console.error('Error in getNotifications:', error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getSentRequests = async (req, res) => {
    try {
        const { userEmail } = req.query;
        const user = await User.findOne({ email: userEmail });
        if (!user) return res.status(404).json({ success: false, message: "User not found." });
        return res.status(200).json({ success: true, sentRequests: user.sentRequests });
    } catch (error) {
        console.error('Error in getSentRequests:', error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getPendingRequestsCount = async (req, res) => {
    try {
        const { userEmail } = req.query;
        const user = await User.findOne({ email: userEmail });
        if (!user) return res.status(404).json({ success: false, message: "User not found." });
        const pendingCount = user.incomingRequests.filter(req => req.status === 'pending').length;
        return res.status(200).json({ success: true, count: pendingCount });
    } catch (error) {
        console.error('Error in getPendingRequestsCount:', error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// --- MODIFIED `sendMessage` to include push notification to the chat partner ---
export const sendMessage = async (req, res) => {
    try {
        const { chatId, senderId, text } = req.body;
        if (!mongoose.Types.ObjectId.isValid(chatId) || !mongoose.Types.ObjectId.isValid(senderId)) {
            return res.status(400).json({ success: false, message: "Invalid chat or sender ID." });
        }
        
        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ success: false, message: "Chat not found." });

        chat.messages.push({ senderId, text });
        await chat.save();
        
        // 1. Identify the recipient
        const recipientId = chat.participants.find(p => p.toString() !== senderId);
        
        // 2. Fetch sender's name and recipient's token
        const [sender, recipient] = await Promise.all([
            User.findById(senderId).select('name'),
            User.findById(recipientId).select('pushNotificationToken notificationPermission')
        ]);

        // 3. Send notification if token is available and user allows it
        if (recipient && recipient.pushNotificationToken && recipient.notificationPermission === 'granted') {
            const message = {
                token: recipient.pushNotificationToken,
                data: {
                    type: 'NEW_CHAT_MESSAGE',
                    chatId: chatId.toString(),
                    senderId: senderId,
                    senderName: sender.name,
                },
                notification: {
                    title: `New Message from ${sender.name}`,
                    body: text.length > 50 ? text.substring(0, 50) + '...' : text,
                },
            };
            await admin.messaging().send(message);
            console.log('Successfully sent chat notification to:', recipientId.toString());
        }

        return res.status(200).json({ success: true, message: "Message sent." });
    } catch (error) {
        console.error('Error in sendMessage:', error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { chatId } = req.query;
        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).json({ success: false, message: "Invalid chat ID." });
        }
        const chat = await Chat.findById(chatId).populate('messages.senderId', 'name _id');
        if (!chat) return res.status(404).json({ success: false, message: "Chat not found." });
        return res.status(200).json({ success: true, messages: chat.messages });
    } catch (error) {
        console.error('Error in getMessages:', error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const sendOnlineRequest = sendCashRequest;
