// This is a placeholder file to ensure the backend starts without errors, 
// as it was referenced in auth.js. 
// You must ensure this initializes your Firebase Admin SDK correctly.

import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let isInitialized = false;

const initializeFirebaseAdmin = () => {
    if (!isInitialized) {
        try {
            // Check for necessary environment variables for Firebase Admin SDK
            if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
                console.warn("FIREBASE_SERVICE_ACCOUNT_KEY environment variable not found. Push notifications will be disabled.");
                return;
            }

            // Parse the service account JSON
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            isInitialized = true;
            console.log("Firebase Admin SDK initialized successfully.");
        } catch (error) {
            console.error("Failed to initialize Firebase Admin SDK:", error);
            // This prevents auth.js from crashing if the configuration is bad, but alerts the developer.
        }
    }
};

export default initializeFirebaseAdmin;
