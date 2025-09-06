import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAEWQ-OOxzr3pDChENjF-Q1gmL0N-WhUq0",
  authDomain: "bussales-80225.firebaseapp.com",
  projectId: "bussales-80225",
  storageBucket: "bussales-80225.firebasestorage.app",
  messagingSenderId: "931407031218",
  appId: "1:931407031218:web:22e572717dd2476adcd2ab",
  measurementId: "G-4JNQDE6HNS"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app, 'europe-west1')  // Use europe-west1 region

// Function exports
export const startCall = httpsCallable(functions, 'startCall')
export const startCallWithPrompt = httpsCallable(functions, 'startCallWithPrompt')
export const getStats = httpsCallable(functions, 'getStats')
export const createBatchCall = httpsCallable(functions, 'createBatchCall')
export const getBatchCallStatus = httpsCallable(functions, 'getBatchCallStatus')

// Types
export type LeadStatus =
  | 'new'
  | 'retry_queue'
  | 'abgebrochen_queue'
  | 'trash_queue'
  | 'dm_direct_queue'
  | 'do_not_call'

export type CallOutcome =
  | 'connected_gatekeeper'
  | 'connected_dm'
  | 'transferred'
  | 'no_answer'
  | 'busy'
  | 'voicemail'
  | 'hung_up_by_contact'
  | 'declined'
  | 'aborted'

export interface Lead {
  id?: string
  company: string
  contact_name?: string
  role?: 'gatekeeper' | 'decision_maker' | 'unknown'
  phone: string
  email?: string
  source?: 'OVN' | 'Fuhrparkliste' | 'Sonstiges'
  status: LeadStatus
  next_retry_at?: Date | null
  notes?: string
  created_at: Date
  updated_at: Date
}

export interface CallAttempt {
  id?: string
  lead_id: string
  started_at: Date
  ended_at?: Date
  outcome?: CallOutcome
  agent_id?: string
  transfer_target?: string
}