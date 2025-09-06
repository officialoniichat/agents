# 🎯 FINALE SETUP ANLEITUNG

## Klarstellung: Service Account vs Web App Config

- **Service Account** (`serviceKeyBussales.json`) = NUR für Backend/Functions ✅ (Hast du bereits)
- **Web App Config** = Für Frontend (React) - BRAUCHST DU NOCH!

## Was du JETZT machen musst:

### 1. Web App in Firebase erstellen (2 Min)

```bash
1. Öffne: https://console.firebase.google.com/project/bussales-80225/settings/general
2. Scrolle zu "Your apps"
3. Klicke "Add app" → Wähle "Web" (</> Symbol)
4. App nickname: "Sales Portal"
5. ✅ "Also set up Firebase Hosting" (optional)
6. Register app
7. Du siehst jetzt einen Code-Block mit firebaseConfig
```

### 2. Config kopieren (30 Sek)

Kopiere NUR diese 3 Werte:
- `apiKey: "AIzaSy..."`
- `messagingSenderId: "123456789"`
- `appId: "1:123456789:web:abc123"`

### 3. In .env.local eintragen (1 Min)

Öffne `/web/.env.local` und ersetze:
```env
VITE_FIREBASE_API_KEY=AIzaSy... (dein echter Key)
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789 (deine echte ID)
VITE_FIREBASE_APP_ID=1:123456789:web:abc123 (deine echte App ID)
```

### 4. Sales-Nummer eintragen (30 Sek)

In `/functions/.env`:
```env
SALES_PHONE_NUMBER=+49[DEINE_ECHTE_NUMMER]
```

### 5. Install & Deploy (5 Min)

```bash
# Terminal 1: Functions
cd /Users/danielkashi/Desktop/CallAgent/buskoa-ai/functions
npm install
npm run deploy

# Notiere dir die Webhook URL die ausgegeben wird!
# z.B. https://europe-west1-bussales-80225.cloudfunctions.net/handleElevenLabsWebhook
```

```bash
# Terminal 2: Web UI
cd /Users/danielkashi/Desktop/CallAgent/buskoa-ai/web
npm install
npm run dev

# Öffnet auf http://localhost:5173
```

### 6. ElevenLabs Webhook eintragen (1 Min)

1. Gehe zu deinem Agent "Fabian2.0"
2. Settings → Webhooks
3. Add Webhook URL: Die URL aus Schritt 5
4. Enable all events

### 7. Erster Test

1. Browser: http://localhost:5173
2. Register Account (beliebige Email)
3. Firebase Console → Firestore → "leads" collection → Add document:
```json
{
  "company": "Test GmbH",
  "phone": "+49123456789",
  "status": "new",
  "created_at": NOW,
  "updated_at": NOW
}
```
4. Im Dashboard: Click auf "Call" beim Lead

## ✅ Das war's!

System läuft. Check die Logs:
```bash
firebase functions:log --only handleElevenLabsWebhook
```

## Troubleshooting

**"Permission denied" Error:**
```bash
firebase deploy --only firestore:rules
```

**Webhook empfängt nichts:**
- Prüfe ob URL mit "europe-west1" beginnt (nicht "us-central1")
- Test mit: `curl -X POST [WEBHOOK_URL] -H "Content-Type: application/json" -d '{"type":"test"}'`

**Functions Deploy Error:**
```bash
cd functions
rm -rf node_modules package-lock.json
npm install
npm run deploy
```