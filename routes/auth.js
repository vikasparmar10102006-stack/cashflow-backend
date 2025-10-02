import { Router } from "express";
import { authGoogle } from '../controllers/auth.js'

const router = Router();

router.post("/google", authGoogle);

export default router;