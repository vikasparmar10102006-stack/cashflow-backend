import admin from 'firebase-admin';
import fs from 'fs'; // 📍 NEW: Import the file system module 📍

const initializeFirebaseAdmin = () => {
    if (!admin.apps.length) {
        try {
            // 📍 NEW: Read the service account file synchronously and parse it 📍
            const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
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
