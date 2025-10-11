// cashflow/cashflow-backend/firebaseAdmin.js

import admin from 'firebase-admin';
// import fs from 'fs'; // 📍 REMOVED: No longer reading file system 📍
import dotenv from 'dotenv';

dotenv.config();

const initializeFirebaseAdmin = () => {
    if (!admin.apps.length) {
        try {
            // ⭐ --- MODIFIED: Load credentials from environment variable --- ⭐
            const keyJson = process.env.FIREBASE_KEY_JSON;
            
            if (!keyJson) {
                console.error("FIREBASE_KEY_JSON environment variable is missing.");
                process.exit(1);
            }
            
            // The JSON must be parsed from the environment variable string
            const serviceAccount = JSON.parse(keyJson);

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log("Firebase Admin SDK initialized successfully.");
        } catch (error) {
            console.error("Error initializing Firebase Admin SDK:", error);
            // It's crucial to exit the process if Firebase init fails
            // as the app cannot function without it.
            process.exit(1);
        }
    }
};

export default initializeFirebaseAdmin;