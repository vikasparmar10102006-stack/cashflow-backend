// firebaseAdmin.js
import admin from "firebase-admin";
import dotenv from "dotenv";
dotenv.config();

let isInitialized = false;

const initializeFirebaseAdmin = () => {
  if (isInitialized) return;

  try {
    const keyString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!keyString) {
      console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT_KEY environment variable not found. Push notifications will be disabled.");
      return;
    }

    const serviceAccount = JSON.parse(keyString);

    // 🟢 Ensure the project ID is included — critical for correct FCM endpoint
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

    isInitialized = true;
    console.log(`✅ Firebase Admin initialized for project: ${serviceAccount.project_id}`);
  } catch (error) {
    console.error("❌ Failed to initialize Firebase Admin SDK:", error);
  }
};

export default initializeFirebaseAdmin;
