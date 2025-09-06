import { useState } from 'react'
import { db } from '../firebase'
import { collection, addDoc, Timestamp } from 'firebase/firestore'

interface CallEntry {
  id: string
  phone: string
  geschaeftsfuehrer: string
  unternehmen: string
  anrede: string
  status: 'pending' | 'calling' | 'completed' | 'failed'
}

const CallCampaign = () => {
  const [calls, setCalls] = useState<CallEntry[]>([])
  const [phone, setPhone] = useState('')
  const [geschaeftsfuehrer, setGeschaeftsfuehrer] = useState('')
  const [unternehmen, setUnternehmen] = useState('')
  const [anrede, setAnrede] = useState('Herrn')
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentCallIndex, setCurrentCallIndex] = useState(-1)
  const [debugLog, setDebugLog] = useState<string[]>([])

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setDebugLog(prev => [...prev.slice(-9), `${timestamp}: ${message}`])
  }

  const addToQueue = () => {
    if (!phone || !geschaeftsfuehrer) {
      alert('Telefonnummer und Name des Geschäftsführers sind erforderlich!')
      return
    }

    const newCall: CallEntry = {
      id: Date.now().toString(),
      phone: phone.startsWith('+49') ? phone : `+49${phone.replace(/^0/, '')}`,
      geschaeftsfuehrer,
      unternehmen: unternehmen || 'Unbekannt',
      anrede,
      status: 'pending'
    }

    setCalls([...calls, newCall])
    
    // Clear form
    setPhone('')
    setGeschaeftsfuehrer('')
    setUnternehmen('')
    setAnrede('Herrn')
  }

  const removeFromQueue = (id: string) => {
    setCalls(calls.filter(c => c.id !== id))
  }

  const startCampaign = async () => {
    if (calls.length === 0) {
      alert('Füge mindestens einen Anruf zur Liste hinzu!')
      return
    }

    setIsProcessing(true)
    
    try {
      // Create leads in Firestore for all calls
      const leadPromises = calls.map(call => 
        addDoc(collection(db, 'leads'), {
          company: call.unternehmen,
          contact_name: call.geschaeftsfuehrer,
          phone: call.phone,
          status: 'new',
          source: 'Campaign',
          notes: `Geschäftsführer: ${call.geschaeftsfuehrer}`,
          created_at: Timestamp.now(),
          updated_at: Timestamp.now()
        })
      )
      
      const leadRefs = await Promise.all(leadPromises)
      
      // Prepare calls for batch with lead IDs
      const batchCalls = calls.map((call, index) => ({
        phone: call.phone,
        geschaeftsfuehrer: call.geschaeftsfuehrer,
        unternehmen: call.unternehmen,
        anrede: call.anrede,
        leadId: leadRefs[index].id
      }))

      // Import the batch call function
      const { createBatchCall } = await import('../firebase')
      
      // Start batch call
      const result = await createBatchCall({
        calls: batchCalls,
        campaignName: `Campaign-${new Date().toISOString()}`
      })

      console.log('Batch call started:', result)
      
      // Update all calls to calling status
      setCalls(prev => prev.map(c => ({ ...c, status: 'calling' })))
      
      alert(`Kampagne gestartet! ${calls.length} Anrufe werden durchgeführt.`)
      
    } catch (error: any) {
      console.error('Error starting campaign:', error)
      
      // Better error display and logging
      const errorMessage = error.message || error.code || 'Unknown error'
      const errorDetails = error.details || error.cause || null
      
      addDebugLog(`ERROR: ${errorMessage}`)
      addDebugLog(`Code: ${error.code || 'N/A'}`)
      if (errorDetails) {
        addDebugLog(`Details: ${JSON.stringify(errorDetails, null, 2)}`)
      }
      addDebugLog(`Full Error: ${JSON.stringify(error, null, 2)}`)
      
      alert(`Fehler beim Starten der Kampagne: ${errorMessage}`)
      // Update all calls to failed status
      setCalls(prev => prev.map(c => ({ ...c, status: 'failed' })))
    } finally {
      setIsProcessing(false)
      setCurrentCallIndex(-1)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#999'
      case 'calling': return '#FFA500'
      case 'completed': return '#4CAF50'
      case 'failed': return '#F44336'
      default: return '#999'
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>📞 Anruf-Kampagne starten</h1>
      
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <h2>Neuen Anruf hinzufügen</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '0.5fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Anrede *
            </label>
            <select
              value={anrede}
              onChange={(e) => setAnrede(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            >
              <option value="Herrn">Herrn</option>
              <option value="Frau">Frau</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Telefonnummer *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+49 123 456789"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Name Geschäftsführer *
            </label>
            <input
              type="text"
              value={geschaeftsfuehrer}
              onChange={(e) => setGeschaeftsfuehrer(e.target.value)}
              placeholder="Max Mustermann"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Unternehmensname (optional)
            </label>
            <input
              type="text"
              value={unternehmen}
              onChange={(e) => setUnternehmen(e.target.value)}
              placeholder="Transport GmbH"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>
        </div>
        
        <button
          onClick={addToQueue}
          disabled={isProcessing}
          style={{
            padding: '0.75rem 2rem',
            fontSize: '1rem',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            opacity: isProcessing ? 0.6 : 1
          }}
        >
          ➕ Zur Liste hinzufügen
        </button>
      </div>

      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Anruf-Liste ({calls.length} Einträge)</h2>
          
          {calls.length > 0 && !isProcessing && (
            <button
              onClick={startCampaign}
              style={{
                padding: '1rem 2rem',
                fontSize: '1.1rem',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🚀 ALLE ANRUFEN
            </button>
          )}
          
          {isProcessing && (
            <div style={{ 
              padding: '1rem',
              backgroundColor: '#FFA500',
              color: 'white',
              borderRadius: '4px'
            }}>
              ⏳ Anruf {currentCallIndex + 1} von {calls.length}...
            </div>
          )}
        </div>

        {calls.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem',
            color: '#999' 
          }}>
            Noch keine Anrufe in der Liste. Füge oben Anrufe hinzu!
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '1rem', textAlign: 'left' }}>#</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Telefonnummer</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Geschäftsführer</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Unternehmen</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call, index) => (
                <tr key={call.id} style={{ 
                  borderBottom: '1px solid #eee',
                  backgroundColor: currentCallIndex === index ? '#FFF3E0' : 'transparent'
                }}>
                  <td style={{ padding: '1rem' }}>{index + 1}</td>
                  <td style={{ padding: '1rem' }}>{call.phone}</td>
                  <td style={{ padding: '1rem', fontWeight: 'bold' }}>{call.geschaeftsfuehrer}</td>
                  <td style={{ padding: '1rem' }}>{call.unternehmen}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '4px',
                      backgroundColor: getStatusColor(call.status),
                      color: 'white',
                      fontSize: '0.9rem'
                    }}>
                      {call.status === 'pending' && '⏸ Wartend'}
                      {call.status === 'calling' && '📞 Anruf läuft'}
                      {call.status === 'completed' && '✅ Abgeschlossen'}
                      {call.status === 'failed' && '❌ Fehlgeschlagen'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {!isProcessing && call.status === 'pending' && (
                      <button
                        onClick={() => removeFromQueue(call.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#F44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Entfernen
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Debug Log Panel */}
      {debugLog.length > 0 && (
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#FFF3E0',
          borderRadius: '8px',
          border: '1px solid #FF9800'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>🐛 Debug Log</h3>
            <button 
              onClick={() => setDebugLog([])}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#FF9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Clear Log
            </button>
          </div>
          <div style={{
            marginTop: '1rem',
            maxHeight: '200px',
            overflowY: 'auto',
            backgroundColor: '#000',
            color: '#0F0',
            padding: '1rem',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.9rem'
          }}>
            {debugLog.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </div>
      )}

      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: '#E3F2FD',
        borderRadius: '8px',
        border: '1px solid #2196F3'
      }}>
        <h3>ℹ️ So funktioniert's:</h3>
        <ol>
          <li>Füge alle Anrufe zur Liste hinzu (Nummer, Name, Firma)</li>
          <li>Der Agent wird automatisch den Namen verwenden: "Spreche ich mit Herrn/Frau [Name]?"</li>
          <li>Bei Bestätigung → sofortige Weiterleitung an Sales</li>
          <li>Batch Call startet alle Anrufe gleichzeitig</li>
        </ol>
      </div>
    </div>
  )
}

export default CallCampaign