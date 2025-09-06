import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';
import axios from 'axios';
import { 
  LeadStatus, 
  CallOutcome, 
  ElevenLabsWebhookEvent,
  Lead
} from './types';

// Initialize with service account
const serviceAccount = require('../serviceKeyBussales.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'bussales-80225'
});
const db = admin.firestore();
const corsHandler = cors({ origin: true });

// Helper functions
const now = () => admin.firestore.Timestamp.now();

async function setLeadStatus(
  leadId: string, 
  status: LeadStatus, 
  retryHours?: number
) {
  const updateData: Partial<Lead> = { 
    status, 
    updated_at: now() 
  };
  
  if (retryHours) {
    const ms = retryHours * 60 * 60 * 1000;
    updateData.next_retry_at = admin.firestore.Timestamp.fromMillis(Date.now() + ms);
  } else {
    updateData.next_retry_at = null;
  }
  
  await db.collection('leads').doc(leadId).update(updateData);
}

async function logCallEvent(
  attemptId: string, 
  eventType: string, 
  payload?: any
) {
  await db.collection('call_attempts').doc(attemptId).update({
    events: admin.firestore.FieldValue.arrayUnion({
      t: now(),
      type: eventType,
      payload
    }),
    ended_at: now()
  });
}

async function createOrUpdateAttempt(
  attemptId: string,
  leadId: string,
  agentId?: string
): Promise<string> {
  const attemptRef = db.collection('call_attempts').doc(attemptId);
  await attemptRef.set({
    lead_id: leadId,
    started_at: now(),
    agent_id: agentId || 'elevenlabs-default'
  }, { merge: true });
  
  return attemptRef.id;
}

// Webhook handler for ElevenLabs events
export const elevenLabsWebhook = functions
  .runWith({ 
    timeoutSeconds: 60
  })
  .https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
      try {
        // Log incoming event for debugging
        console.log('Raw webhook body:', JSON.stringify(req.body, null, 2));

        const event: ElevenLabsWebhookEvent = req.body;
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
                outcome: 'transferred' as CallOutcome,
                transfer_target: event.meta?.transferTarget || 'sales'
              })
            ]);
            break;

          case 'call.no_answer':
            await Promise.all([
              logCallEvent(attemptId, 'no_answer', event),
              setLeadStatus(event.leadId, 'abgebrochen_queue', 2), // Retry in 2 hours
              db.collection('call_attempts').doc(attemptId).update({ 
                outcome: 'no_answer' as CallOutcome 
              })
            ]);
            break;

          case 'call.busy':
            await Promise.all([
              logCallEvent(attemptId, 'busy', event),
              setLeadStatus(event.leadId, 'abgebrochen_queue', 1), // Retry in 1 hour
              db.collection('call_attempts').doc(attemptId).update({ 
                outcome: 'busy' as CallOutcome 
              })
            ]);
            break;

          case 'voicemail.detected':
            await Promise.all([
              logCallEvent(attemptId, 'voicemail', event),
              setLeadStatus(event.leadId, 'abgebrochen_queue', 24), // Retry tomorrow
              db.collection('call_attempts').doc(attemptId).update({ 
                outcome: 'voicemail' as CallOutcome 
              })
            ]);
            break;

          case 'call.hung_up':
            await Promise.all([
              logCallEvent(attemptId, 'hung_up', event),
              setLeadStatus(event.leadId, 'trash_queue'),
              db.collection('call_attempts').doc(attemptId).update({ 
                outcome: 'hung_up_by_contact' as CallOutcome 
              })
            ]);
            break;

          case 'call.declined':
            await Promise.all([
              logCallEvent(attemptId, 'declined', event),
              setLeadStatus(event.leadId, 'trash_queue'),
              db.collection('call_attempts').doc(attemptId).update({ 
                outcome: 'declined' as CallOutcome 
              })
            ]);
            break;

          case 'do_not_call.requested':
            await Promise.all([
              logCallEvent(attemptId, 'do_not_call', event),
              setLeadStatus(event.leadId, 'do_not_call'),
              db.collection('call_attempts').doc(attemptId).update({ 
                outcome: 'declined' as CallOutcome 
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
      } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  });

// Retry dispatcher (triggered by Cloud Scheduler)
export const dispatchRetries = functions
  .runWith({ 
    timeoutSeconds: 540,
    memory: '512MB'
  })
  .https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
      try {
        // Check for scheduler header (security)
        const isScheduler = req.headers['x-cloudscheduler'] === 'true';
        const isLocal = req.headers['host']?.includes('localhost');
        
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
          const lead = { id: doc.id, ...doc.data() } as Lead & { id: string };
          
          // TODO: Trigger ElevenLabs outbound call here
          // For now, just log and mark as processing
          console.log('Would call:', lead.company, lead.phone);
          
          // Reset retry time to prevent duplicate processing
          await doc.ref.update({
            next_retry_at: admin.firestore.Timestamp.fromMillis(
              Date.now() + 30 * 60 * 1000 // 30 min buffer
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
      } catch (error) {
        console.error('Retry dispatcher error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  });

// Manual call trigger (for testing or manual dialing)
export const startCall = functions
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

        const lead = leadDoc.data() as Lead;
        
        // Check if lead is callable
        if (lead.status === 'do_not_call') {
          res.status(400).json({ error: 'Lead is on do-not-call list' });
          return;
        }

        // Trigger ElevenLabs outbound call
        const elevenLabsResponse = await axios.post(
          `https://api.elevenlabs.io/v1/convai/conversations/agent_01k0hehhm1e6c89n0ex2aqdqpp/phone_call`,
          {
            customer_phone_number: lead.phone,
            agent_phone_number: process.env.SALES_PHONE_NUMBER || '+49123456789',
            metadata: {
              lead_id: leadId,
              company: lead.company
            }
          },
          {
            headers: {
              'xi-api-key': process.env.ELEVENLABS_API_KEY || 'sk_23ab82af21dbb1217cc16587a7b5cb4666c223fbea687f60',
              'Content-Type': 'application/json'
            }
          }
        );
        
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
      } catch (error) {
        console.error('Start call error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  });

// Export the new universal webhook handler
export { handleElevenLabsWebhook } from './elevenlabs-webhook';

// Export the custom prompt call function
export { startCallWithPrompt } from './start-call-with-prompt';

// Export batch calling functions
export { createBatchCall, getBatchCallStatus } from './batch-call';

// Get lead statistics
export const getStats = functions
  .https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
      try {
        const stats: Record<string, number> = {};
        
        // Count leads by status
        const statuses: LeadStatus[] = [
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
      } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  });