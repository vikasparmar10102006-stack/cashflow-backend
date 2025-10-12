import { Router } from "express";
import { authGoogle, clearPushNotificationToken } from '../controllers/auth.js'

const router = Router();

router.post("/google", authGoogle);
router.post("/clear-token", clearPushNotificationToken); // <-- NEW ROUTE ADDED

export default router;
