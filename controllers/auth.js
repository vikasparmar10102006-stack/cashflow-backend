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

// ✅ Full fixed version of authGoogle function — ensures new users get location updated properly
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

        // ✅ 1. Define fields to be set (scalar updates)
        const setFields = {
            name,
            givenName,
            familyName,
            picture,
            notificationPermission,
            locationPermission,
            pushNotificationToken,
        };

        // ✅ 2. Define the full update query object
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
        });

        const radiusInMeters = radius * 1000;
        const recipientIds = nearbyUsers
            .filter(user => {
                // ⭐ ROBUST LOCATION CHECK: Prioritizes the dedicated currentLocation field.
                const userLocation = user.currentLocation || (user.locationHistory && user.locationHistory.length > 0 ? user.locationHistory[0] : null);
                
                if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
                    return false; // Skip users who have no valid location data
                }

                return calculateDistance(requesterLocation, userLocation) <= radiusInMeters;
            })
            .map(user => user._id);
        
        if (recipientIds.length > 0) {
            await User.updateMany(
                { _id: { $in: recipientIds } },
                { $push: { incomingRequests: { $each: [newRequest], $position: 0 } } }
            );
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

// ✅ --- REWRITTEN LOGIC FOR `updateRequestStatus` --- ✅
export const updateRequestStatus = async (req, res) => {
    try {
        const { userEmail, requestId, newStatus } = req.body;
        if (newStatus !== 'accepted') {
            // For now, we only handle the 'accepted' status for this new logic.
            // Declining a request can be handled by simply removing it from the user's incoming list if needed.
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

// ✅ --- NEW CONTROLLER FUNCTION `getRequestAcceptors` --- ✅
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


// 🟢 NEW: IMPLEMENTATION OF `completeRequest`
export const completeRequest = async (req, res) => {
    try {
        const { requesterEmail, requestId, acceptorId } = req.body;
        
        // 1. Find the requester and the sent request
        const requester = await User.findOne({ email: requesterEmail });
        if (!requester) return res.status(404).json({ success: false, message: "Requester not found." });

        const sentRequestIndex = requester.sentRequests.findIndex(req => req._id.toString() === requestId);
        if (sentRequestIndex === -1) return res.status(404).json({ success: false, message: "Sent request not found." });

        const sentRequest = requester.sentRequests[sentRequestIndex];
        
        // 2. Validate the request state
        if (sentRequest.status === 'completed') {
            return res.status(400).json({ success: false, message: "This request is already completed." });
        }
        
        // 3. Update status of the sent request to 'completed'
        await User.updateOne(
            { _id: requester._id, "sentRequests._id": requestId },
            { $set: { "sentRequests.$.status": "completed" } }
        );

        // 4. Find all other users who received this request and remove it from their incoming list
        // This query finds all users whose incomingRequests array contains an element with the given requestId.
        await User.updateMany(
            { "incomingRequests._id": requestId },
            { $pull: { incomingRequests: { _id: new mongoose.Types.ObjectId(requestId) } } }
        );

        // 5. Send a notification to the selected acceptor
        const acceptor = await User.findById(acceptorId);
        if (acceptor && acceptor.pushNotificationToken) {
            const message = {
                token: acceptor.pushNotificationToken,
                data: {
                    type: 'TRANSACTION_COMPLETED',
                    requestId: requestId,
                    title: 'Transaction Complete!',
                    body: `${requester.name} has marked the deal for ₹${sentRequest.amount} as completed.`,
                },
            };
            await admin.messaging().send(message);
        }

        return res.status(200).json({ success: true, message: "Request marked as completed successfully." });

    } catch (error) {
        console.error('Error in completeRequest:', error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


// --- Other functions (getNotifications, getSentRequests, etc.) remain the same ---

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

export const sendMessage = async (req, res) => {
    try {
        const { chatId, senderId, text } = req.body;
        if (!mongoose.Types.ObjectId.isValid(chatId) || !mongoose.Types.ObjectId.isValid(senderId)) {
            return res.status(400).json({ success: false, message: "Invalid chat or sender ID." });
        }
        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ success: false, message: "Chat not found." });

        const newMessage = { senderId, text };
        chat.messages.push(newMessage);
        await chat.save();
        
        // 🟢 NEW: SOCKET.IO EMIT FOR REAL-TIME MESSAGE DELIVERY
        const io = req.app.get('io');
        const populatedMessage = { 
            ...newMessage, 
            _id: chat.messages[chat.messages.length - 1]._id, // Get the MongoDB ID
            createdAt: chat.messages[chat.messages.length - 1].createdAt,
            senderId: { _id: senderId, name: (await User.findById(senderId))?.name } // Populate sender name
        };
        io.to(chatId).emit('newMessage', populatedMessage);
        
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
