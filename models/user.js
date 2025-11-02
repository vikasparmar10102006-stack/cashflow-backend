import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  accuracy: { type: Number },
  timestamp: { type: Date, default: Date.now },
});

// Schema for an individual acceptor (used in sentRequests array)
const acceptorSchema = new mongoose.Schema({
  acceptorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  acceptorName: { type: String, required: true },
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  acceptedAt: { type: Date, default: Date.now },
});

// 🟢 NEW: Added isSystemMessage field to message schema
const messageSchema = new mongoose.Schema({
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: { type: String, required: true },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    isSystemMessage: { type: Boolean, default: false }, // 🟢 NEW
});

const requestSchema = new mongoose.Schema({
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requesterName: { type: String, required: true },
  amount: { type: Number, required: true },
  tip: { type: Number, default: 0 },
  instructions: { type: String },
  type: { type: String, enum: ['cash', 'online'], required: true },
  // 🟢 EDITED: Added 'expired' status for 24-hour auto-cancellation
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'active', 'completed', 'expired'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  
  // FIX 1: Add chatId to the request schema. This is necessary for INCOMING requests 
  // (the acceptor's side) to know which chat room to join.
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },
  
  // Array to hold all users who have accepted the request (only relevant for SENT requests)
  acceptors: [acceptorSchema], 
});

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String },
  givenName: { type: String },
  familyName: { type: String },
  picture: { type: String },
  notificationPermission: { type: String, default: 'denied' },
  locationPermission: { type: String, default: 'denied' },
  locationHistory: [locationSchema],

  // ✅ FIX: Define the new currentLocation field using the locationSchema
  currentLocation: { type: locationSchema, default: null },

  incomingRequests: [requestSchema],
  sentRequests: [requestSchema],
  pushNotificationToken: { type: String }, // 🟢 NEW: For FCM
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;