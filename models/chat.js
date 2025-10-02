import mongoose from 'mongoose';

const ChatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  messages: [{
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    text: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
}, { timestamps: true });

// Check if the model already exists before defining it
const Chat = mongoose.models.Chat || mongoose.model('Chat', ChatSchema);

export default Chat;