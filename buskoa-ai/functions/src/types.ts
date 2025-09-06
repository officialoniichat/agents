import { Timestamp } from 'firebase-admin/firestore';

export type LeadStatus =
  | 'new'
  | 'retry_queue'
  | 'abgebrochen_queue'
  | 'trash_queue'
  | 'dm_direct_queue'
  | 'do_not_call';

export type CallOutcome =
  | 'connected_gatekeeper'
  | 'connected_dm'
  | 'transferred'
  | 'no_answer'
  | 'busy'
  | 'voicemail'
  | 'hung_up_by_contact'
  | 'declined'
  | 'aborted';

export type ContactRole = 'gatekeeper' | 'decision_maker' | 'unknown';

export interface Lead {
  company: string;
  contact_name?: string;
  role?: ContactRole;
  phone: string;
  email?: string;
  source?: 'OVN' | 'Fuhrparkliste' | 'Sonstiges';
  status: LeadStatus;
  next_retry_at?: Timestamp | null;
  notes?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CallAttempt {
  lead_id: string;
  started_at: Timestamp;
  ended_at?: Timestamp;
  outcome?: CallOutcome;
  events?: CallEvent[];
  agent_id?: string;
  transfer_target?: string;
  recording_url?: string;
}

export interface CallEvent {
  t: Timestamp;
  type: string;
  payload?: any;
}

export interface Meeting {
  lead_id: string;
  when: Timestamp;
  channel: 'Phone' | 'Zoom' | 'Teams' | 'InPerson';
  created_by: string;
  notes?: string;
  created_at: Timestamp;
}

export interface ElevenLabsWebhookEvent {
  type: string;
  callId?: string;
  leadId: string;
  phone: string;
  agentId?: string;
  timestamp?: number;
  meta?: Record<string, any>;
}