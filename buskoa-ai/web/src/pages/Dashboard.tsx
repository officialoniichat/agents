import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  updateDoc,
  doc,
  Timestamp
} from 'firebase/firestore'
import { db, Lead, LeadStatus, startCall } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

const STATUSES: LeadStatus[] = [
  'new',
  'retry_queue',
  'abgebrochen_queue',
  'dm_direct_queue',
  'trash_queue',
  'do_not_call'
]

const STATUS_COLORS: Record<LeadStatus, string> = {
  'new': '#2196F3',
  'retry_queue': '#FF9800',
  'abgebrochen_queue': '#FFC107',
  'dm_direct_queue': '#4CAF50',
  'trash_queue': '#9E9E9E',
  'do_not_call': '#F44336'
}

const Dashboard = () => {
  const [leads, setLeads] = useState<Record<LeadStatus, Lead[]>>({} as any)
  const [loading, setLoading] = useState(true)
  const [calling, setCalling] = useState<string | null>(null)
  const { currentUser, logout } = useAuth()

  useEffect(() => {
    const unsubscribes: (() => void)[] = []

    STATUSES.forEach(status => {
      const q = query(
        collection(db, 'leads'),
        where('status', '==', status)
      )

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const statusLeads = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Lead))

        setLeads(prev => ({
          ...prev,
          [status]: statusLeads
        }))
        setLoading(false)
      })

      unsubscribes.push(unsubscribe)
    })

    return () => unsubscribes.forEach(unsub => unsub())
  }, [])

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: Timestamp.now()
      }

      if (newStatus === 'retry_queue' || newStatus === 'abgebrochen_queue') {
        // Set retry for 2 hours from now
        updateData.next_retry_at = Timestamp.fromDate(
          new Date(Date.now() + 2 * 60 * 60 * 1000)
        )
      } else {
        updateData.next_retry_at = null
      }

      await updateDoc(doc(db, 'leads', leadId), updateData)
    } catch (error) {
      console.error('Error updating lead status:', error)
      alert('Failed to update lead status')
    }
  }

  const handleStartCall = async (leadId: string) => {
    setCalling(leadId)
    try {
      const result = await startCall({ leadId })
      console.log('Call started:', result.data)
      alert(`Call initiated for lead ${leadId}`)
    } catch (error) {
      console.error('Error starting call:', error)
      alert('Failed to start call')
    } finally {
      setCalling(null)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading leads...
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h1>Buskoa AI - Sales Dashboard</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <a 
            href="/campaign"
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#4CAF50',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}
          >
            🚀 Kampagne starten
          </a>
          <span>Welcome, {currentUser?.email}</span>
          <button
            onClick={logout}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1rem'
      }}>
        {STATUSES.map(status => (
          <div
            key={status}
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                backgroundColor: STATUS_COLORS[status],
                color: 'white',
                padding: '1rem',
                fontSize: '1.1rem',
                fontWeight: 'bold'
              }}
            >
              {status.replace(/_/g, ' ').toUpperCase()}
              <span style={{ float: 'right' }}>
                ({leads[status]?.length || 0})
              </span>
            </div>

            <div style={{ padding: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
              {leads[status]?.map(lead => (
                <div
                  key={lead.id}
                  style={{
                    backgroundColor: '#f5f5f5',
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <Link 
                    to={`/lead/${lead.id}`}
                    style={{
                      textDecoration: 'none',
                      color: 'inherit'
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>{lead.company}</div>
                    <div style={{ fontSize: '0.9rem', color: '#666' }}>
                      {lead.phone}
                    </div>
                    {lead.contact_name && (
                      <div style={{ fontSize: '0.9rem', color: '#666' }}>
                        {lead.contact_name}
                      </div>
                    )}
                  </Link>

                  <div style={{ 
                    display: 'flex', 
                    gap: '0.5rem', 
                    marginTop: '0.5rem',
                    flexWrap: 'wrap'
                  }}>
                    {status !== 'do_not_call' && (
                      <button
                        onClick={() => handleStartCall(lead.id!)}
                        disabled={calling === lead.id}
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          cursor: calling === lead.id ? 'not-allowed' : 'pointer',
                          opacity: calling === lead.id ? 0.6 : 1
                        }}
                      >
                        {calling === lead.id ? 'Calling...' : 'Call'}
                      </button>
                    )}
                    
                    {status !== 'retry_queue' && (
                      <button
                        onClick={() => handleStatusChange(lead.id!, 'retry_queue')}
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#FF9800',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        Retry
                      </button>
                    )}
                    
                    {status !== 'do_not_call' && (
                      <button
                        onClick={() => handleStatusChange(lead.id!, 'do_not_call')}
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#F44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        DNC
                      </button>
                    )}
                  </div>

                  {lead.next_retry_at && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#999',
                      marginTop: '0.25rem'
                    }}>
                      Retry: {new Date(
                        lead.next_retry_at instanceof Timestamp
                          ? lead.next_retry_at.toDate()
                          : lead.next_retry_at
                      ).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}

              {(!leads[status] || leads[status].length === 0) && (
                <div style={{
                  padding: '1rem',
                  textAlign: 'center',
                  color: '#999'
                }}>
                  No leads in this queue
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Dashboard