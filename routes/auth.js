import { Router } from "express";
import { authGoogle, clearPushNotificationToken } from '../controllers/auth.js'

const router = Router();

router.post("/google", authGoogle);
// ✅ NEW: Route for clearing the push notification token on sign out
router.post("/clear-token", clearPushNotificationToken);

export default router;
