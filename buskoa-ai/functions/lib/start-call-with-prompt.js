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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCallWithPrompt = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const db = admin.firestore();
/**
 * Start a call with custom prompt for specific lead
 * This allows dynamic system prompts with lead-specific information
 */
exports.startCallWithPrompt = functions
    .region('europe-west1')
    .runWith({
    timeoutSeconds: 60,
    memory: '512MB'
})
    .https.onCall(async (data, context) => {
    try {
        const { leadId, customPrompt } = data;
        if (!leadId) {
            throw new functions.https.HttpsError('invalid-argument', 'leadId required');
        }
        // Get lead data
        const leadDoc = await db.collection('leads').doc(leadId).get();
        if (!leadDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Lead not found');
        }
        const lead = leadDoc.data();
        // Check if lead is callable
        if ((lead === null || lead === void 0 ? void 0 : lead.status) === 'do_not_call') {
            throw new functions.https.HttpsError('failed-precondition', 'Lead is on do-not-call list');
        }
        // Get agent ID from env
        const agentId = process.env.ELEVENLABS_AGENT_ID || 'agent_01k0hehhm1e6c89n0ex2aqdqpp';
        // Prepare the call request for ElevenLabs (matching the working format from index.ts)
        const callRequest = {
            customer_phone_number: lead === null || lead === void 0 ? void 0 : lead.phone,
            agent_phone_number: process.env.AGENT_PHONE_NUMBER || '+494074303756',
            metadata: {
                lead_id: leadId,
                company: lead === null || lead === void 0 ? void 0 : lead.company,
                contact_name: lead === null || lead === void 0 ? void 0 : lead.contact_name
            }
        };
        // Call ElevenLabs API to start the conversation using the correct endpoint
        const elevenLabsResponse = await axios_1.default.post(`https://api.elevenlabs.io/v1/convai/conversations/${agentId}/phone_call`, callRequest, {
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY || 'sk_23ab82af21dbb1217cc16587a7b5cb4666c223fbea687f60',
                'Content-Type': 'application/json'
            }
        });
        console.log('Call initiated with custom prompt:', {
            leadId,
            phone: lead === null || lead === void 0 ? void 0 : lead.phone,
            contact: lead === null || lead === void 0 ? void 0 : lead.contact_name,
            response: elevenLabsResponse.data
        });
        // Create call attempt record
        const attemptId = `${leadId}-${Date.now()}`;
        await db.collection('call_attempts').doc(attemptId).set({
            lead_id: leadId,
            started_at: admin.firestore.Timestamp.now(),
            agent_id: process.env.ELEVENLABS_AGENT_ID,
            custom_prompt_used: true,
            events: [{
                    t: admin.firestore.Timestamp.now(),
                    type: 'call_initiated',
                    data: { customPrompt: !!customPrompt }
                }]
        });
        return {
            success: true,
            attemptId,
            conversation_id: elevenLabsResponse.data.conversation_id,
            lead: {
                id: leadId,
                company: lead === null || lead === void 0 ? void 0 : lead.company,
                phone: lead === null || lead === void 0 ? void 0 : lead.phone,
                contact: lead === null || lead === void 0 ? void 0 : lead.contact_name
            }
        };
    }
    catch (error) {
        console.error('Error starting call with prompt:', error);
        // Check if it's an API error
        if (error.response) {
            throw new functions.https.HttpsError('internal', `ElevenLabs API error: ${error.response.data.message || error.response.status}`);
        }
        else {
            throw new functions.https.HttpsError('internal', error.message || 'Failed to start call');
        }
    }
});
//# sourceMappingURL=start-call-with-prompt.js.map