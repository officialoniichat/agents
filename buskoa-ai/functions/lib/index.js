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
exports.getStats = exports.getBatchCallStatus = exports.createBatchCall = exports.startCallWithPrompt = exports.handleElevenLabsWebhook = exports.startCall = exports.dispatchRetries = exports.elevenLabsWebhook = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
const axios_1 = __importDefault(require("axios"));
// Initialize with service account
const serviceAccount = require('../serviceKeyBussales.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'bussales-80225'
});
const db = admin.firestore();
const corsHandler = (0, cors_1.default)({ origin: true });
// Helper functions
const now = () => admin.firestore.Timestamp.now();
async function setLeadStatus(leadId, status, retryHours) {
    const updateData = {
        status,
        updated_at: now()
    };
    if (retryHours) {
        const ms = retryHours * 60 * 60 * 1000;
        updateData.next_retry_at = admin.firestore.Timestamp.fromMillis(Date.now() + ms);
    }
    else {
        updateData.next_retry_at = null;
    }
    await db.collection('leads').doc(leadId).update(updateData);
}
async function logCallEvent(attemptId, eventType, payload) {
    await db.collection('call_attempts').doc(attemptId).update({
        events: admin.firestore.FieldValue.arrayUnion({
            t: now(),
            type: eventType,
            payload
        }),
        ended_at: now()
    });
}
async function createOrUpdateAttempt(attemptId, leadId, agentId) {
    const attemptRef = db.collection('call_attempts').doc(attemptId);
    await attemptRef.set({
        lead_id: leadId,
        started_at: now(),
        agent_id: agentId || 'elevenlabs-default'
    }, { merge: true });
    return attemptRef.id;
}
// Webhook handler for ElevenLabs events
exports.elevenLabsWebhook = functions
    .runWith({
    timeoutSeconds: 60
})
    .https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
        var _a;
        try {
            // Log incoming event for debugging
            console.log('Raw webhook body:', JSON.stringify(req.body, null, 2));
            const event = req.body;
            console.log('Received ElevenLabs event:', event.type, event);
            // Generate attempt ID
            const attemptId = event.callId || `${event.leadId}-${Date.now()}`;
            // Create or update call attempt
            await createOrUpdateAttempt(attemptId, event.leadId, event.agentId);
            // Handle different event types
            switch (event.type) {
                case 'call.started':
                    await logCallEvent(attemptId, 'call_started', event);
                    break;
                case 'connected.gatekeeper':
                    await logCallEvent(attemptId, 'connected_gatekeeper', event);
                    break;
                case 'connected.decision_maker':
                    await logCallEvent(attemptId, 'connected_dm', event);
                    break;
                case 'call.transferred':
                    await Promise.all([
                        logCallEvent(attemptId, 'transferred', event),
                        setLeadStatus(event.leadId, 'dm_direct_queue'),
                        db.collection('call_attempts').doc(attemptId).update({
                            outcome: 'transferred',
                            transfer_target: ((_a = event.meta) === null || _a === void 0 ? void 0 : _a.transferTarget) || 'sales'
                        })
                    ]);
                    break;
                case 'call.no_answer':
                    await Promise.all([
                        logCallEvent(attemptId, 'no_answer', event),
                        setLeadStatus(event.leadId, 'abgebrochen_queue', 2), // Retry in 2 hours
                        db.collection('call_attempts').doc(attemptId).update({
                            outcome: 'no_answer'
                        })
                    ]);
                    break;
                case 'call.busy':
                    await Promise.all([
                        logCallEvent(attemptId, 'busy', event),
                        setLeadStatus(event.leadId, 'abgebrochen_queue', 1), // Retry in 1 hour
                        db.collection('call_attempts').doc(attemptId).update({
                            outcome: 'busy'
                        })
                    ]);
                    break;
                case 'voicemail.detected':
                    await Promise.all([
                        logCallEvent(attemptId, 'voicemail', event),
                        setLeadStatus(event.leadId, 'abgebrochen_queue', 24), // Retry tomorrow
                        db.collection('call_attempts').doc(attemptId).update({
                            outcome: 'voicemail'
                        })
                    ]);
                    break;
                case 'call.hung_up':
                    await Promise.all([
                        logCallEvent(attemptId, 'hung_up', event),
                        setLeadStatus(event.leadId, 'trash_queue'),
                        db.collection('call_attempts').doc(attemptId).update({
                            outcome: 'hung_up_by_contact'
                        })
                    ]);
                    break;
                case 'call.declined':
                    await Promise.all([
                        logCallEvent(attemptId, 'declined', event),
                        setLeadStatus(event.leadId, 'trash_queue'),
                        db.collection('call_attempts').doc(attemptId).update({
                            outcome: 'declined'
                        })
                    ]);
                    break;
                case 'do_not_call.requested':
                    await Promise.all([
                        logCallEvent(attemptId, 'do_not_call', event),
                        setLeadStatus(event.leadId, 'do_not_call'),
                        db.collection('call_attempts').doc(attemptId).update({
                            outcome: 'declined'
                        })
                    ]);
                    break;
                case 'call.ended':
                    await logCallEvent(attemptId, 'call_ended', event);
                    break;
                default:
                    console.log('Unhandled event type:', event.type);
                    await logCallEvent(attemptId, event.type, event);
            }
            res.json({ success: true, attemptId });
        }
        catch (error) {
            console.error('Webhook error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
});
// Retry dispatcher (triggered by Cloud Scheduler)
exports.dispatchRetries = functions
    .runWith({
    timeoutSeconds: 540,
    memory: '512MB'
})
    .https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
        var _a;
        try {
            // Check for scheduler header (security)
            const isScheduler = req.headers['x-cloudscheduler'] === 'true';
            const isLocal = (_a = req.headers['host']) === null || _a === void 0 ? void 0 : _a.includes('localhost');
            if (!isScheduler && !isLocal) {
                res.status(403).json({ error: 'Unauthorized' });
                return;
            }
            // Get current time window (business hours check)
            const now = new Date();
            const hour = now.getHours();
            const day = now.getDay();
            // Skip weekends and non-business hours (9-17)
            if (day === 0 || day === 6 || hour < 9 || hour >= 17) {
                res.json({
                    message: 'Outside business hours',
                    skipped: true
                });
                return;
            }
            // Query leads ready for retry
            const retryLeads = await db.collection('leads')
                .where('status', 'in', ['retry_queue', 'abgebrochen_queue'])
                .where('next_retry_at', '<=', admin.firestore.Timestamp.now())
                .limit(10)
                .get();
            const results = [];
            for (const doc of retryLeads.docs) {
                const lead = Object.assign({ id: doc.id }, doc.data());
                // TODO: Trigger ElevenLabs outbound call here
                // For now, just log and mark as processing
                console.log('Would call:', lead.company, lead.phone);
                // Reset retry time to prevent duplicate processing
                await doc.ref.update({
                    next_retry_at: admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 60 * 1000 // 30 min buffer
                    )
                });
                results.push({
                    leadId: lead.id,
                    company: lead.company,
                    phone: lead.phone
                });
            }
            res.json({
                processed: results.length,
                leads: results
            });
        }
        catch (error) {
            console.error('Retry dispatcher error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
});
// Manual call trigger (for testing or manual dialing)
exports.startCall = functions
    .runWith({
    timeoutSeconds: 60
})
    .https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
        try {
            const { leadId, agentId } = req.body;
            if (!leadId) {
                res.status(400).json({ error: 'leadId required' });
                return;
            }
            // Get lead data
            const leadDoc = await db.collection('leads').doc(leadId).get();
            if (!leadDoc.exists) {
                res.status(404).json({ error: 'Lead not found' });
                return;
            }
            const lead = leadDoc.data();
            // Check if lead is callable
            if (lead.status === 'do_not_call') {
                res.status(400).json({ error: 'Lead is on do-not-call list' });
                return;
            }
            // Trigger ElevenLabs outbound call
            const elevenLabsResponse = await axios_1.default.post(`https://api.elevenlabs.io/v1/convai/conversations/agent_01k0hehhm1e6c89n0ex2aqdqpp/phone_call`, {
                customer_phone_number: lead.phone,
                agent_phone_number: process.env.SALES_PHONE_NUMBER || '+49123456789',
                metadata: {
                    lead_id: leadId,
                    company: lead.company
                }
            }, {
                headers: {
                    'xi-api-key': process.env.ELEVENLABS_API_KEY || 'sk_23ab82af21dbb1217cc16587a7b5cb4666c223fbea687f60',
                    'Content-Type': 'application/json'
                }
            });
            console.log('ElevenLabs call initiated:', elevenLabsResponse.data);
            // Create call attempt record
            const attemptId = `${leadId}-${Date.now()}`;
            await createOrUpdateAttempt(attemptId, leadId, agentId);
            res.json({
                success: true,
                attemptId,
                lead: {
                    id: leadId,
                    company: lead.company,
                    phone: lead.phone
                }
            });
        }
        catch (error) {
            console.error('Start call error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
});
// Export the new universal webhook handler
var elevenlabs_webhook_1 = require("./elevenlabs-webhook");
Object.defineProperty(exports, "handleElevenLabsWebhook", { enumerable: true, get: function () { return elevenlabs_webhook_1.handleElevenLabsWebhook; } });
// Export the custom prompt call function
var start_call_with_prompt_1 = require("./start-call-with-prompt");
Object.defineProperty(exports, "startCallWithPrompt", { enumerable: true, get: function () { return start_call_with_prompt_1.startCallWithPrompt; } });
// Export batch calling functions
var batch_call_1 = require("./batch-call");
Object.defineProperty(exports, "createBatchCall", { enumerable: true, get: function () { return batch_call_1.createBatchCall; } });
Object.defineProperty(exports, "getBatchCallStatus", { enumerable: true, get: function () { return batch_call_1.getBatchCallStatus; } });
// Get lead statistics
exports.getStats = functions
    .https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
        try {
            const stats = {};
            // Count leads by status
            const statuses = [
                'new',
                'retry_queue',
                'abgebrochen_queue',
                'trash_queue',
                'dm_direct_queue',
                'do_not_call'
            ];
            for (const status of statuses) {
                const count = await db.collection('leads')
                    .where('status', '==', status)
                    .count()
                    .get();
                stats[status] = count.data().count;
            }
            // Count today's calls
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todaysCalls = await db.collection('call_attempts')
                .where('started_at', '>=', admin.firestore.Timestamp.fromDate(todayStart))
                .count()
                .get();
            stats.calls_today = todaysCalls.data().count;
            res.json(stats);
        }
        catch (error) {
            console.error('Stats error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
});
//# sourceMappingURL=index.js.map