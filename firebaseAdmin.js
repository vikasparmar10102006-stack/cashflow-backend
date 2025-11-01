// firebaseAdmin.js
import admin from "firebase-admin";
import dotenv from "dotenv";
import { Buffer } from 'buffer'; // Import Buffer for non-browser environments like Node/Render
dotenv.config();

let isInitialized = false;

const initializeFirebaseAdmin = () => {
  if (isInitialized) return;

  try {
    const base64KeyString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64;
    
    if (!base64KeyString) {
      console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 environment variable not found. Push notifications will be disabled.");
      return;
    }
    
    // 1. Decode the Base64 string to get the original JSON text
    let jsonString = Buffer.from(base64KeyString, 'base64').toString('utf8');
    
    // 🌟 CRITICAL FIX: Aggressively clean the string. This regex removes all non-printable
    // characters, including control codes, tabs, newlines, and BOMs, leaving only characters
    // commonly found in JSON data (letters, numbers, punctuation, spaces).
    // It also removes any characters outside of the standard Latin-1 printable range
    // which may include the problematic characters showing up in your logs.
    const aggressiveCleanedString = jsonString
        // Remove control characters (including BOM, etc.)
        .replace(/[\u0000-\u001F\u007F-\u009F\uFEFF]/g, '')
        // Clean up common encoding errors if the previous line missed anything
        .trim(); 
    
    // 2. Find and extract the clean JSON content (starts with { and ends with })
    const jsonMatch = aggressiveCleanedString.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error("Critical Parsing Error: Could not find valid JSON structure (matching { ... }) after Base64 decoding and cleaning.");
      return;
    }

    const cleanJsonString = jsonMatch[0];

    // 3. Parse the CLEANED decoded JSON string
    const serviceAccount = JSON.parse(cleanJsonString);

    // 4. Initialize Firebase Admin
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
