import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

const initializeFirebaseAdmin = () => {
    if (!admin.apps.length) {
        try {
            // ⭐ CRITICAL FIX: Load the credentials from the secure environment variable (FIREBASE_KEY_JSON).
            // This prevents the server from crashing when the local file is missing.
            const keyJson = process.env.FIREBASE_KEY_JSON;
            
            if (!keyJson) {
                console.error("FIREBASE_KEY_JSON environment variable is missing. Check Render settings.");
                process.exit(1);
            }
            
            // The JSON string must be parsed back into a JavaScript object
            const serviceAccount = JSON.parse(keyJson);

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log("Firebase Admin SDK initialized successfully from environment variable.");
        } catch (error) {
            // Catches errors from JSON.parse (if the string is invalid) or admin.initializeApp
            console.error("Error initializing Firebase Admin SDK. Check FIREBASE_KEY_JSON format:", error);
            process.exit(1);
        }
    }
};

export default initializeFirebaseAdmin;
