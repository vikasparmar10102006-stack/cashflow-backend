import pkg from 'agora-access-token';
import dotenv from 'dotenv';

dotenv.config();

// Extract CommonJS exports from the default import
const { RtcTokenBuilder, RtcRole } = pkg;

// IMPORTANT: In production (Render), these MUST be set as environment variables.
// We remove the hardcoded secrets to prevent accidental leaks.
const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

// Set the role of the user (publisher or subscriber)
const role = RtcRole.PUBLISHER;

// Token expiration time (in seconds)
const expirationTimeInSeconds = 3600;

export const generateRtcToken = (req, res) => {
    try {
        const { channelName, uid } = req.query; // channelName is typically chatId
        
        // 🟢 ADD THIS LOG LINE
        console.log(`[Token Gen] Request for Channel: ${channelName}, UID: ${uid}`);

        if (!channelName) {
            return res.status(400).json({ success: false, message: 'Channel name (chatId) is required.' });
        }
        
        // 🔴 CRITICAL CHECK: Ensure secrets are loaded from environment
        if (!APP_ID || !APP_CERTIFICATE) {
             console.error("CRITICAL: Agora App ID or Certificate is missing from environment variables.");
             return res.status(500).json({
                 success: false,
                 message: 'Server Configuration Error: Agora credentials are not loaded.',
             });
        }

        const numericUid = uid ? parseInt(uid) : 0;
        
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

        // Build Agora RTC token
        const token = RtcTokenBuilder.buildTokenWithUid(
            APP_ID,
            APP_CERTIFICATE,
            channelName,
            numericUid,
            role,
            privilegeExpiredTs
        );

        return res.status(200).json({ success: true, token, uid: numericUid });

    } catch (error) {
        console.error('Error generating Agora RTC token:', error);
        return res.status(500).json({ success: false, message: 'Failed to generate token.' });
    }
};