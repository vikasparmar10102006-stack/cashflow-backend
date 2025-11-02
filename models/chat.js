import mongoose from 'mongoose';

// 🟢 NEW: Define the message schema separately (for use in the ChatSchema)
const MessageSchema = new mongoose.Schema({
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
    // 🟢 NEW: Flag for system messages (call logs, etc.)
    isSystemMessage: { type: Boolean, default: false }, 
});


const ChatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  // 🟢 CHANGE: Use the new MessageSchema for the messages array
  messages: [MessageSchema],
}, { timestamps: true });

// Check if the model already exists before defining it
const Chat = mongoose.models.Chat || mongoose.model('Chat', ChatSchema);

export default Chat;