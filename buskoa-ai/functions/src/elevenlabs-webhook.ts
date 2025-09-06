import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { LeadStatus, CallOutcome } from './types';

const db = admin.firestore();
const now = () => admin.firestore.Timestamp.now();

// ElevenLabs Webhook Event Types (aus deren Docs)
interface ElevenLabsEvent {
  type: string;
  conversation_id?: string;
  agent_id?: string;
  customer?: {
    phone_number?: string;
  };
  metadata?: Record<string, any>;
  transcript?: string;
  timestamp?: string;
  [key: string]: any;
}

/**
 * Universal webhook handler for ALL ElevenLabs events
 * Logs everything and maps to our internal events
 */
export const handleElevenLabsWebhook = functions
  .region('europe-west1')
  .runWith({ 
    timeoutSeconds: 60,
    memory: '512MB'
  })
  .https.onRequest(async (req, res) => {
    try {
      const event: ElevenLabsEvent = req.body;
      
      // Log EVERY event for debugging
      console.log('📞 ElevenLabs Event Received:', {
        type: event.type,
        conversation_id: event.conversation_id,
        agent_id: event.agent_id,
        full_event: JSON.stringify(event, null, 2)
      });

      // Extract lead_id from metadata or conversation_id
      const leadId = event.metadata?.lead_id || 
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
          console.log('👤 Customer connected:', event.customer?.phone_number);
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

    } catch (error) {
      console.error('❌ Webhook Error:', error);
      res.status(500).json({ 
        error: 'Processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

// Helper functions
async function updateLeadStatus(leadId: string, status: string | LeadStatus) {
  try {
    await db.collection('leads').doc(leadId).update({
      status: status as LeadStatus,
      updated_at: now()
    });
  } catch (error) {
    console.error('Error updating lead status:', error);
  }
}

async function handleTransfer(leadId: string, attemptId: string) {
  await Promise.all([
    updateLeadStatus(leadId, 'dm_direct_queue'),
    db.collection('call_attempts').doc(attemptId).update({
      outcome: 'transferred' as CallOutcome,
      transferred_at: now()
    })
  ]);
}

async function handleNoAnswer(leadId: string, attemptId: string) {
  await Promise.all([
    db.collection('leads').doc(leadId).update({
      status: 'abgebrochen_queue' as LeadStatus,
      next_retry_at: admin.firestore.Timestamp.fromMillis(
        Date.now() + 2 * 60 * 60 * 1000 // Retry in 2 hours
      ),
      updated_at: now()
    }),
    db.collection('call_attempts').doc(attemptId).update({
      outcome: 'no_answer' as CallOutcome,
      ended_at: now()
    })
  ]);
}

async function handleVoicemail(leadId: string, attemptId: string) {
  await Promise.all([
    db.collection('leads').doc(leadId).update({
      status: 'abgebrochen_queue' as LeadStatus,
      next_retry_at: admin.firestore.Timestamp.fromMillis(
        Date.now() + 24 * 60 * 60 * 1000 // Retry tomorrow
      ),
      updated_at: now()
    }),
    db.collection('call_attempts').doc(attemptId).update({
      outcome: 'voicemail' as CallOutcome,
      ended_at: now()
    })
  ]);
}

async function handleHungUp(leadId: string, attemptId: string) {
  await Promise.all([
    updateLeadStatus(leadId, 'trash_queue'),
    db.collection('call_attempts').doc(attemptId).update({
      outcome: 'hung_up_by_contact' as CallOutcome,
      ended_at: now()
    })
  ]);
}

async function finishCallAttempt(attemptId: string) {
  await db.collection('call_attempts').doc(attemptId).update({
    ended_at: now()
  });
}

async function analyzeTranscript(leadId: string, attemptId: string, transcript: string) {
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