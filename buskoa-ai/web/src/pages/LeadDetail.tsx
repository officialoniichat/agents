import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  doc, 
  getDoc, 
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  Timestamp
} from 'firebase/firestore'
import { db, Lead, CallAttempt, LeadStatus } from '../firebase'

const LeadDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [lead, setLead] = useState<Lead | null>(null)
  const [attempts, setAttempts] = useState<CallAttempt[]>([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return

    // Fetch lead data
    const fetchLead = async () => {
      try {
        const leadDoc = await getDoc(doc(db, 'leads', id))
        if (leadDoc.exists()) {
          setLead({ id: leadDoc.id, ...leadDoc.data() } as Lead)
          setNotes(leadDoc.data().notes || '')
        }
      } catch (error) {
        console.error('Error fetching lead:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLead()

    // Subscribe to call attempts
    const q = query(
      collection(db, 'call_attempts'),
      where('lead_id', '==', id),
      orderBy('started_at', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const attemptsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CallAttempt))
      setAttempts(attemptsList)
    })

    return () => unsubscribe()
  }, [id])

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!id || !lead) return
    
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: Timestamp.now()
      }

      if (newStatus === 'retry_queue' || newStatus === 'abgebrochen_queue') {
        updateData.next_retry_at = Timestamp.fromDate(
          new Date(Date.now() + 2 * 60 * 60 * 1000)
        )
      } else {
        updateData.next_retry_at = null
      }

      await updateDoc(doc(db, 'leads', id), updateData)
      setLead({ ...lead, ...updateData })
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Failed to update status')
    }
  }

  const handleSaveNotes = async () => {
    if (!id) return
    
    setSaving(true)
    try {
      await updateDoc(doc(db, 'leads', id), {
        notes,
        updated_at: Timestamp.now()
      })
      alert('Notes saved successfully')
    } catch (error) {
      console.error('Error saving notes:', error)
      alert('Failed to save notes')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateMeeting = async () => {
    if (!id) return
    
    const when = prompt('Enter meeting date/time (YYYY-MM-DD HH:MM):')
    if (!when) return

    try {
      await addDoc(collection(db, 'meetings'), {
        lead_id: id,
        when: Timestamp.fromDate(new Date(when)),
        channel: 'Phone',
        created_by: 'sales',
        created_at: Timestamp.now(),
        notes: ''
      })
      alert('Meeting scheduled successfully')
    } catch (error) {
      console.error('Error creating meeting:', error)
      alert('Failed to schedule meeting')
    }
  }

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>
  }

  if (!lead) {
    return <div style={{ padding: '2rem' }}>Lead not found</div>
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <button
        onClick={() => navigate('/')}
        style={{
          marginBottom: '1rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        ← Back to Dashboard
      </button>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2rem'
      }}>
        <div>
          <h2>{lead.company}</h2>
          
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            marginBottom: '1rem'
          }}>
            <h3>Lead Information</h3>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <div><strong>Phone:</strong> {lead.phone}</div>
              {lead.email && <div><strong>Email:</strong> {lead.email}</div>}
              {lead.contact_name && <div><strong>Contact:</strong> {lead.contact_name}</div>}
              {lead.role && <div><strong>Role:</strong> {lead.role}</div>}
              {lead.source && <div><strong>Source:</strong> {lead.source}</div>}
              <div><strong>Status:</strong> {lead.status}</div>
              {lead.next_retry_at && (
                <div>
                  <strong>Next Retry:</strong> {new Date(
                    lead.next_retry_at instanceof Timestamp
                      ? lead.next_retry_at.toDate()
                      : lead.next_retry_at
                  ).toLocaleString()}
                </div>
              )}
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                value={lead.status}
                onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
                style={{
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #ddd'
                }}
              >
                <option value="new">New</option>
                <option value="retry_queue">Retry Queue</option>
                <option value="abgebrochen_queue">Abgebrochen Queue</option>
                <option value="dm_direct_queue">DM Direct Queue</option>
                <option value="trash_queue">Trash Queue</option>
                <option value="do_not_call">Do Not Call</option>
              </select>

              <button
                onClick={handleCreateMeeting}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Schedule Meeting
              </button>
            </div>
          </div>

          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3>Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                minHeight: '150px',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
              placeholder="Add notes about this lead..."
            />
            <button
              onClick={handleSaveNotes}
              disabled={saving}
              style={{
                marginTop: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1
              }}
            >
              {saving ? 'Saving...' : 'Save Notes'}
            </button>
          </div>
        </div>

        <div>
          <h3>Call History</h3>
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            maxHeight: '600px',
            overflowY: 'auto'
          }}>
            {attempts.length > 0 ? (
              attempts.map(attempt => (
                <div
                  key={attempt.id}
                  style={{
                    padding: '1rem',
                    borderBottom: '1px solid #eee',
                    marginBottom: '0.5rem'
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>
                    {new Date(
                      attempt.started_at instanceof Timestamp
                        ? attempt.started_at.toDate()
                        : attempt.started_at
                    ).toLocaleString()}
                  </div>
                  {attempt.outcome && (
                    <div style={{
                      marginTop: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: attempt.outcome === 'transferred' ? '#4CAF50' : '#FF9800',
                      color: 'white',
                      borderRadius: '4px',
                      display: 'inline-block',
                      fontSize: '0.9rem'
                    }}>
                      {attempt.outcome.replace(/_/g, ' ').toUpperCase()}
                    </div>
                  )}
                  {attempt.transfer_target && (
                    <div style={{ marginTop: '0.5rem', color: '#666' }}>
                      Transferred to: {attempt.transfer_target}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ color: '#999', textAlign: 'center' }}>
                No call attempts yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LeadDetail