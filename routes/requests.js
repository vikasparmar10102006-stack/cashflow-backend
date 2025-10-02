import { Router } from "express";
import {
  sendCashRequest,
  updateRequestStatus,
  getNotifications,
  getPendingRequestsCount,
  getSentRequests,
  sendMessage,
  getMessages,
  sendOnlineRequest,
  getRequestAcceptors,
} from '../controllers/auth.js';

// ✅ FIX: Import the shop controller functions
import { addShop, getShops } from '../controllers/shop.js';

const router = Router();

// Request routes
router.post('/request-cash', sendCashRequest);
router.post('/update-request-status', updateRequestStatus);
router.get('/notifications', getNotifications);
router.get('/sent-requests', getSentRequests);
router.get('/pending-count', getPendingRequestsCount);

// Shop routes (FIX for 404 error - Mobile app needs /get-shops)
router.post('/add-shop', addShop);
router.get('/get-shops', getShops);

// Acceptors route
router.get('/request-acceptors', getRequestAcceptors);

// Chat routes
router.post('/send-message', sendMessage);
router.get('/chat-messages', getMessages);

router.post('/request-online', sendOnlineRequest);

export default router;
  