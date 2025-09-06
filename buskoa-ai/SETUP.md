# Quick Setup Guide - 10 Minuten zum Live-System

## Schritt 1: Firebase Setup (3 Min)

```bash
# Terminal öffnen, ins Projekt navigieren
cd buskoa-ai

# Firebase installieren & einloggen
npm install -g firebase-tools
firebase login

# Firebase initialisieren (wähle existing project oder create new)
firebase init
# Wähle: Firestore, Functions, Emulators
# Functions: TypeScript, ESLint=yes
```

## Schritt 2: Firebase Console (2 Min)

1. Öffne [console.firebase.google.com](https://console.firebase.google.com)
2. **Authentication** → Get Started → Email/Password → Enable
3. **Firestore Database** → Create Database → Production Mode → eur3 (europe-west)
4. **Project Settings** → Add Web App → Name: "Sales Portal"
5. Kopiere die Config

## Schritt 3: Config einfügen (1 Min)

Editiere `/web/src/firebase.ts`:

```typescript
const firebaseConfig = {
  // Hier die kopierten Werte einfügen
}
```

## Schritt 4: Install & Deploy (2 Min)

```bash
# Functions Dependencies
cd functions
npm install

# Deploy Functions
npm run deploy

# Web Dependencies  
cd ../web
npm install
```

## Schritt 5: ElevenLabs Setup (2 Min)

1. Login bei [elevenlabs.io](https://elevenlabs.io)
2. Conversational AI → Create Agent
3. Kopiere diese Config:

```yaml
Name: Anna BuskoAI
Voice: Aria (German)
Language: German
First Message: "Guten Tag, mein Name ist Anna von BuskoAI. Könnte ich bitte kurz mit der Geschäftsführung sprechen?"

Tools:
- Transfer to number: +49 [DEINE_SALES_NUMMER]
- End call: enabled
- Voicemail detection: enabled

Webhook URL: https://[DEIN-PROJEKT].cloudfunctions.net/elevenLabsWebhook
```

## Fertig! Test durchführen

```bash
# Local starten
cd web
npm run dev
```

1. Browser: http://localhost:5173
2. Register Sales Account
3. Lead manuell in Firestore anlegen
4. Test-Anruf von ElevenLabs starten

## Troubleshooting Checkliste

❌ **Functions Deploy Error**
```bash
npm install -g firebase-tools@latest
firebase deploy --only functions
```

❌ **Auth nicht verfügbar**
→ Firebase Console → Authentication → Get Started

❌ **Webhook 404**
→ Check Function Name: `elevenLabsWebhook` (case-sensitive!)

❌ **No Leads showing**
→ Firestore → Create Collection "leads" → Add Document

## Production Deployment

```bash
# Build optimized
cd web
npm run build

# Deploy to Firebase Hosting
firebase init hosting
firebase deploy --only hosting
```

Done! System läuft auf: https://[PROJECT].web.app