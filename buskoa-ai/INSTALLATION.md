# 🚀 Installation & Setup - Buskoa AI

## Was du noch brauchst:

### 1. Firebase Web App Config
```bash
1. Gehe zu: https://console.firebase.google.com/project/bussales-80225/settings/general
2. Scrolle zu "Your apps"
3. Klicke "Add app" → Web → Name: "Sales Portal"
4. Kopiere die Config-Werte
5. Füge sie in /web/src/firebase.ts ein (apiKey, messagingSenderId, appId)
```

### 2. Dependencies installieren
```bash
# Im Root-Verzeichnis
cd /Users/danielkashi/Desktop/CallAgent/buskoa-ai

# Functions dependencies
cd functions
npm install

# Web dependencies
cd ../web
npm install
```

### 3. Functions deployen
```bash
cd functions
npm run deploy

# Oder einzeln:
firebase deploy --only functions:handleElevenLabsWebhook
firebase deploy --only functions:startCall
```

### 4. ElevenLabs Webhook konfigurieren

Nach dem Deploy bekommst du eine URL wie:
```
https://europe-west1-bussales-80225.cloudfunctions.net/handleElevenLabsWebhook
```

Diese URL musst du in ElevenLabs eintragen:
1. Gehe zu deinem Agent "Fabian2.0"
2. Settings → Webhooks → Add Webhook
3. URL: Die obige Functions-URL
4. Events: Alle aktivieren

### 5. Sales-Telefonnummer eintragen

In `/functions/.env`:
```env
SALES_PHONE_NUMBER=+49[DEINE_ECHTE_SALES_NUMMER]
```

### 6. Test-Lead erstellen

```bash
# Firebase Console öffnen
https://console.firebase.google.com/project/bussales-80225/firestore

# Collection "leads" → Add document
{
  "company": "Test GmbH",
  "phone": "+49[EINE_TEST_NUMMER]",
  "status": "new",
  "created_at": NOW,
  "updated_at": NOW
}
```

### 7. Sales-User anlegen & UI starten

```bash
# Development
cd web
npm run dev

# Browser: http://localhost:5173
# Register mit: sales@buskoa.de
```

### 8. Erster Test-Anruf

Option A: Über UI
- Login ins Dashboard
- Lead anklicken → "Call" Button

Option B: Über ElevenLabs direkt
- Agents → Fabian2.0 → Test Call

## ✅ Checklist vorm Go-Live

- [ ] Firebase Web Config komplett in `/web/src/firebase.ts`
- [ ] Dependencies installiert (`npm install` in beiden Ordnern)
- [ ] Functions deployed (Check: Firebase Console → Functions)
- [ ] Webhook URL in ElevenLabs eingetragen
- [ ] Sales-Telefonnummer in `.env` korrekt
- [ ] Mindestens 1 Test-Lead in Firestore
- [ ] Sales-User kann sich einloggen

## 🔍 Debug & Monitoring

```bash
# Functions Logs ansehen
firebase functions:log --only handleElevenLabsWebhook

# Oder in Firebase Console:
https://console.firebase.google.com/project/bussales-80225/functions/logs
```

## ⚠️ Häufige Fehler

**"Permission denied" in Firestore:**
```bash
firebase deploy --only firestore:rules
```

**Functions Deploy Error:**
```bash
cd functions
npm run build  # Check ob TypeScript kompiliert
firebase deploy --only functions --force
```

**Webhook empfängt nichts:**
- Check ob URL korrekt (europe-west1!)
- In ElevenLabs: Events aktiviert?
- Test mit curl:
```bash
curl -X POST https://europe-west1-bussales-80225.cloudfunctions.net/handleElevenLabsWebhook \
  -H "Content-Type: application/json" \
  -d '{"type":"test","conversation_id":"test123"}'
```