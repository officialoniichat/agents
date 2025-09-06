"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleElevenLabsWebhook = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
const now = () => admin.firestore.Timestamp.now();
/**
 * Universal webhook handler for ALL ElevenLabs events
 * Logs everything and maps to our internal events
 */
exports.handleElevenLabsWebhook = functions
    .region('europe-west1')
    .runWith({
    timeoutSeconds: 60,
    memory: '512MB'
})
    .https.onRequest(async (req, res) => {
    var _a, _b;
    try {
        const event = req.body;
        // Log EVERY event for debugging
        console.log('📞 ElevenLabs Event Received:', {
            type: event.type,
            conversation_id: event.conversation_id,
            agent_id: event.agent_id,
            full_event: JSON.stringify(event, null, 2)
        });
        // Extract lead_id from metadata or conversation_id
        const leadId = ((_a = event.metadata) === null || _a === void 0 ? void 0 : _a.lead_id) ||
            event.conversation_id ||
            `unknown-${Date.now()}`;
        // Create or update call attempt
        const attemptId = event.conversation_id || `${leadId}-${Date.now()}`;
        const attemptRef = db.collection('call_attempts').doc(attemptId);
        await attemptRef.set({
            lead_id: leadId,
            agent_id: event.agent_id || 'agent_01k0hehhm1e6c89n0ex2aqdqpp',
            started_at: now(),
            raw_events: admin.firestore.FieldValue.arrayUnion({
                timestamp: now(),
                type: event.type,
                data: event
            })
        }, { merge: true });
        // Map ElevenLabs events to our system
        switch (event.type) {
            // Conversation lifecycle events
            case 'conversation.started':
            case 'call_started':
            case 'phone-call-started':
                console.log('✅ Call started for lead:', leadId);
                await updateLeadStatus(leadId, 'in_call');
                break;
            case 'conversation.ended':
            case 'call_ended':
            case 'phone-call-ended':
                console.log('📴 Call ended for lead:', leadId);
                await finishCallAttempt(attemptId);
                break;
            // Transfer events
            case 'conversation.transferred':
            case 'transfer_initiated':
            case 'phone-call-transferred':
                console.log('🔄 Call transferred to sales for lead:', leadId);
                await handleTransfer(leadId, attemptId);
                break;
            // Connection events
            case 'user_connected':
            case 'customer_connected':
                console.log('👤 Customer connected:', (_b = event.customer) === null || _b === void 0 ? void 0 : _b.phone_number);
                break;
            // No answer / Voicemail
            case 'no_answer':
            case 'phone-call-no-answer':
                console.log('❌ No answer for lead:', leadId);
                await handleNoAnswer(leadId, attemptId);
                break;
            case 'voicemail_detected':
            case 'phone-call-voicemail':
                console.log('📬 Voicemail detected for lead:', leadId);
                await handleVoicemail(leadId, attemptId);
                break;
            // Hang up / Decline
            case 'customer_hung_up':
            case 'phone-call-customer-hung-up':
                console.log('📵 Customer hung up:', leadId);
                await handleHungUp(leadId, attemptId);
                break;
            // Transcript events (für Analyse)
            case 'transcript':
            case 'conversation.transcript':
                if (event.transcript) {
                    await analyzeTranscript(leadId, attemptId, event.transcript);
                }
                break;
            default:
                console.log('⚠️ Unknown event type:', event.type);
                // Still save it for debugging
                await db.collection('audit').add({
                    timestamp: now(),
                    event_type: event.type,
                    lead_id: leadId,
                    raw_data: event
                });
        }
        res.status(200).json({
            success: true,
            processed: event.type,
            lead_id: leadId
        });
    }
    catch (error) {
        console.error('❌ Webhook Error:', error);
        res.status(500).json({
            error: 'Processing failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Helper functions
async function updateLeadStatus(leadId, status) {
    try {
        await db.collection('leads').doc(leadId).update({
            status: status,
            updated_at: now()
        });
    }
    catch (error) {
        console.error('Error updating lead status:', error);
    }
}
async function handleTransfer(leadId, attemptId) {
    await Promise.all([
        updateLeadStatus(leadId, 'dm_direct_queue'),
        db.collection('call_attempts').doc(attemptId).update({
            outcome: 'transferred',
            transferred_at: now()
        })
    ]);
}
async function handleNoAnswer(leadId, attemptId) {
    await Promise.all([
        db.collection('leads').doc(leadId).update({
            status: 'abgebrochen_queue',
            next_retry_at: admin.firestore.Timestamp.fromMillis(Date.now() + 2 * 60 * 60 * 1000 // Retry in 2 hours
            ),
            updated_at: now()
        }),
        db.collection('call_attempts').doc(attemptId).update({
            outcome: 'no_answer',
            ended_at: now()
        })
    ]);
}
async function handleVoicemail(leadId, attemptId) {
    await Promise.all([
        db.collection('leads').doc(leadId).update({
            status: 'abgebrochen_queue',
            next_retry_at: admin.firestore.Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000 // Retry tomorrow
            ),
            updated_at: now()
        }),
        db.collection('call_attempts').doc(attemptId).update({
            outcome: 'voicemail',
            ended_at: now()
        })
    ]);
}
async function handleHungUp(leadId, attemptId) {
    await Promise.all([
        updateLeadStatus(leadId, 'trash_queue'),
        db.collection('call_attempts').doc(attemptId).update({
            outcome: 'hung_up_by_contact',
            ended_at: now()
        })
    ]);
}
async function finishCallAttempt(attemptId) {
    await db.collection('call_attempts').doc(attemptId).update({
        ended_at: now()
    });
}
async function analyzeTranscript(leadId, attemptId, transcript) {
    // Check for important keywords
    const lowerTranscript = transcript.toLowerCase();
    // Check for DNC request
    if (lowerTranscript.includes('nicht mehr anrufen') ||
        lowerTranscript.includes('keine anrufe') ||
        lowerTranscript.includes('sperrliste')) {
        await updateLeadStatus(leadId, 'do_not_call');
        console.log('🚫 DNC request detected for lead:', leadId);
    }
    // Check for interest
    if (lowerTranscript.includes('geschäftsführer') ||
        lowerTranscript.includes('geschäftsführung')) {
        console.log('💼 Decision maker mentioned for lead:', leadId);
    }
    // Save transcript
    await db.collection('call_attempts').doc(attemptId).update({
        transcript: admin.firestore.FieldValue.arrayUnion({
            timestamp: now(),
            text: transcript
        })
    });
}
//# sourceMappingURL=elevenlabs-webhook.js.map