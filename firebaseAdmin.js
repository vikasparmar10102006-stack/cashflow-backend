// firebaseAdmin.js
import admin from "firebase-admin";
import dotenv from "dotenv";
dotenv.config();

let isInitialized = false;

const initializeFirebaseAdmin = () => {
  if (isInitialized) return;

  try {
    // 🟢 CHANGE 1: Use the new Base64 variable name
    const base64KeyString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64;
    
    if (!base64KeyString) {
      console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 environment variable not found. Push notifications will be disabled.");
      return;
    }
    
    // 🟢 CHANGE 2: Decode the Base64 string to get the original JSON text
    const jsonString = Buffer.from(base64KeyString, 'base64').toString('utf8');
    
    // 🟢 CHANGE 3: Parse the decoded JSON string
    const serviceAccount = JSON.parse(jsonString);

    // 🟢 Ensure the project ID is included — critical for correct FCM endpoint
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

    isInitialized = true;
    console.log(`✅ Firebase Admin initialized for project: ${serviceAccount.project_id}`);
  } catch (error) {
    console.error("❌ Failed to initialize Firebase Admin SDK:", error);
    // If we can't initialize, log the environment status to help debug
    console.error(`Debug: FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 is ${process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 ? 'PRESENT' : 'MISSING'}.`);
  }
};

export default initializeFirebaseAdmin;
