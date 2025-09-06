# 🚀 JETZT STARTEN - Alles ist bereit!

## ✅ Was wir haben:

- **Firebase Config**: ✅ Eingetragen
- **Service Account**: ✅ Konfiguriert  
- **ElevenLabs API Key**: ✅ Integriert
- **Agent ID (Fabian2.0)**: ✅ Eingebaut

## 📋 Quick Start (5 Minuten)

### 1. Dependencies installieren & Functions deployen

```bash
# Terminal 1: Functions
cd /Users/danielkashi/Desktop/CallAgent/buskoa-ai/functions
npm install
npm run deploy

# WICHTIG: Notiere die Webhook URL die ausgegeben wird!
# Sie sieht so aus: https://europe-west1-bussales-80225.cloudfunctions.net/handleElevenLabsWebhook
```

### 2. Web UI starten

```bash
# Terminal 2: Frontend
cd /Users/danielkashi/Desktop/CallAgent/buskoa-ai/web
npm install
npm run dev

# Öffnet automatisch: http://localhost:5173
```

### 3. ElevenLabs Webhook konfigurieren

1. Gehe zu: https://elevenlabs.io/app/conversational-ai
2. Wähle Agent "Fabian2.0"
3. Settings → Webhooks → Add Webhook
4. URL: `https://europe-west1-bussales-80225.cloudfunctions.net/handleElevenLabsWebhook`
5. Enable all events

### 4. Sales-Telefonnummer eintragen

Editiere `/functions/.env`:
```env
SALES_PHONE_NUMBER=+49[DEINE_ECHTE_NUMMER]
```

Dann nochmal deployen:
```bash
cd functions
firebase deploy --only functions
```

### 5. Erster Test

1. **Sales User anlegen:**
   - Browser: http://localhost:5173
   - Click "Register"
   - Email: sales@buskoa.de
   - Password: [sicheres password]

2. **Test-Lead erstellen:**
   - Firebase Console: https://console.firebase.google.com/project/bussales-80225/firestore
   - Collection "leads" → Add document:
   ```json
   {
     "company": "Test GmbH",
     "phone": "+491234567890",
     "status": "new",
     "created_at": "SERVER_TIMESTAMP",
     "updated_at": "SERVER_TIMESTAMP"
   }
   ```

3. **Anruf starten:**
   - Im Dashboard auf "Call" beim Lead klicken
   - Oder direkt in ElevenLabs testen

## 🔍 Live Monitoring

```bash
# Functions Logs beobachten
firebase functions:log --only handleElevenLabsWebhook

# Oder in der Console:
https://console.firebase.google.com/project/bussales-80225/functions/logs
```

## ⚠️ Letzte Checks

- [ ] npm install erfolgreich in beiden Ordnern?
- [ ] Functions deployed ohne Fehler?
- [ ] Webhook URL in ElevenLabs eingetragen?
- [ ] Sales-Nummer in .env eingetragen?

## 🎯 Das System läuft!

Sobald du die obigen Schritte gemacht hast:
- Webhook empfängt ALLE Events von ElevenLabs
- Dashboard zeigt Leads in Echtzeit
- Calls werden automatisch getrackt
- Status-Updates funktionieren

Bei Problemen check die Logs - das System loggt ALLES!