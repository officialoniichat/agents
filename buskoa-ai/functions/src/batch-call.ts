import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

const db = admin.firestore();

/**
 * Create a batch call campaign using ElevenLabs Batch Calling API
 */
export const createBatchCall = functions
  .region('europe-west1')
  .runWith({ 
    timeoutSeconds: 60,
    memory: '512MB'
  })
  .https.onCall(async (data, context) => {
    try {
      const { calls, campaignName } = data;
      
      if (!calls || calls.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'No calls provided');
      }

      // Helper function to ensure E.164 format (remove spaces/dashes)
      const toE164 = (phone: string) => phone.replace(/\s|-/g, '');
      
      // Prepare recipients array with personalized first messages
      const recipients = calls.map((call: any) => {
        const anrede = call.anrede ?? 'Herrn';
        const name = call.geschaeftsfuehrer || '';
        const company = call.unternehmen ?? '';

        return {
          phone_number: toE164(call.phone),
          conversation_initiation_client_data: {
            conversation_config_override: {
              agent: {
                language: "de",
                first_message: `Guten Tag hier Schulte, einmal bitte den ${anrede} ${name} Danke.`
              }
            },
            dynamic_variables: {
              manager_name: name,
              company
            }
          }
        };
      });

      // Create batch call request body (JSON)
      const batchRequest = {
        call_name: campaignName || `Campaign-${new Date().toISOString()}`,
        agent_id: 'agent_01k0hehhm1e6c89n0ex2aqdqpp', // Your Fabian2.0 agent ID
        agent_phone_number_id: 'phnum_01jw8qr0ece4qttwjyxdghnjfw', // Your Twilio phone number ID
        scheduled_time_unix: Math.floor(Date.now() / 1000), // Current timestamp for immediate execution
        recipients: recipients
      };

      console.log('Sending batch call request:', JSON.stringify(batchRequest, null, 2));

      // Call ElevenLabs Batch Calling API with correct endpoint
      const response = await axios.post(
        'https://api.elevenlabs.io/v1/convai/batch-calling/submit',
        batchRequest,
        {
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY || 'sk_23ab82af21dbb1217cc16587a7b5cb4666c223fbea687f60',
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Batch call created:', response.data);

      // Store batch info in Firestore (avoid undefined values)
      const apiBatchId = response.data.id ?? response.data.batch_id;
      const batchDocPayload: any = {
        campaign_name: campaignName || batchRequest.call_name,
        total_calls: calls.length,
        status: 'initiated',
        created_at: admin.firestore.Timestamp.now(),
        calls
      };
      if (apiBatchId) batchDocPayload.batch_id = apiBatchId;

      const batchDoc = await db.collection('batch_calls').add(batchDocPayload);

      return {
        success: true,
        batchId: apiBatchId,
        docId: batchDoc.id,
        message: `Batch call started with ${calls.length} recipients`,
        details: response.data
      };

    } catch (error: any) {
      // Focused error logging - only what we need
      console.error('=== BATCH CALL ERROR ===');
      console.error('HTTP Status:', error.response?.status);
      console.error('Error Message:', error.message);
      
      // Deep log the validation details
      if (error.response?.data?.detail) {
        console.error('Validation Errors:');
        try {
          error.response.data.detail.forEach((validationError: any, index: number) => {
            console.error(`  ${index + 1}:`, JSON.stringify(validationError, null, 2));
          });
        } catch (e) {
          console.error('Raw detail:', error.response.data.detail);
        }
      }
      
      console.error('=======================');
      
      // Better error handling - map upstream errors properly
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        
        if (status === 404) {
          throw new functions.https.HttpsError(
            'not-found',
            'ElevenLabs API endpoint not found. Please check configuration.'
          );
        } else if (status === 401 || status === 403) {
          throw new functions.https.HttpsError(
            'permission-denied',
            'API key invalid or lacks permissions for batch calling'
          );
        } else if (status === 422 || status === 400) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            errorData?.detail || errorData?.message || 'Invalid request data'
          );
        } else if (status >= 500) {
          throw new functions.https.HttpsError(
            'unavailable',
            'ElevenLabs service temporarily unavailable'
          );
        }
      }
      
      // Generic error fallback
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Failed to create batch call'
      );
    }
  });

/**
 * Monitor batch call status
 */
export const getBatchCallStatus = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    try {
      const { batchId } = data;
      
      if (!batchId) {
        throw new functions.https.HttpsError('invalid-argument', 'batchId required');
      }

      // Get batch status from ElevenLabs (correct endpoint)
      const response = await axios.get(
        `https://api.elevenlabs.io/v1/convai/batch-calling/${batchId}`,
        {
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY || 'sk_23ab82af21dbb1217cc16587a7b5cb4666c223fbea687f60'
          }
        }
      );

      return {
        success: true,
        status: response.data
      };

    } catch (error: any) {
      console.error('Get batch status error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to get batch status'
      );
    }
  });