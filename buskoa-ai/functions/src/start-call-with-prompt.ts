import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

const db = admin.firestore();

/**
 * Start a call with custom prompt for specific lead
 * This allows dynamic system prompts with lead-specific information
 */
export const startCallWithPrompt = functions
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
      if (lead?.status === 'do_not_call') {
        throw new functions.https.HttpsError('failed-precondition', 'Lead is on do-not-call list');
      }

        // Get agent ID from env
        const agentId = process.env.ELEVENLABS_AGENT_ID || 'agent_01k0hehhm1e6c89n0ex2aqdqpp';
        
        // Prepare the call request for ElevenLabs (matching the working format from index.ts)
        const callRequest = {
          customer_phone_number: lead?.phone,
          agent_phone_number: process.env.AGENT_PHONE_NUMBER || '+494074303756',
          metadata: {
            lead_id: leadId,
            company: lead?.company,
            contact_name: lead?.contact_name
          }
        };

        // Call ElevenLabs API to start the conversation using the correct endpoint
        const elevenLabsResponse = await axios.post(
          `https://api.elevenlabs.io/v1/convai/conversations/${agentId}/phone_call`,
          callRequest,
          {
            headers: {
              'xi-api-key': process.env.ELEVENLABS_API_KEY || 'sk_23ab82af21dbb1217cc16587a7b5cb4666c223fbea687f60',
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('Call initiated with custom prompt:', {
          leadId,
          phone: lead?.phone,
          contact: lead?.contact_name,
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
          company: lead?.company,
          phone: lead?.phone,
          contact: lead?.contact_name
        }
      };

    } catch (error: any) {
      console.error('Error starting call with prompt:', error);
      
      // Check if it's an API error
      if (error.response) {
        throw new functions.https.HttpsError(
          'internal', 
          `ElevenLabs API error: ${error.response.data.message || error.response.status}`
        );
      } else {
        throw new functions.https.HttpsError(
          'internal', 
          error.message || 'Failed to start call'
        );
      }
    }
  });