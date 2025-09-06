# Buskoa AI - Automated B2B Cold Calling System

## Projektanalyse

### Kernkonzept
Vollautomatisiertes KI-Telefonie-System zur B2B-Kaltakquise mit intelligentem Gatekeeper-Handling und sofortiger Weiterleitung an Sales bei Entscheidungsträger-Kontakt.

### Systemarchitektur

```
ElevenLabs Agent (KI-Telefonie)
    ↓
Firebase Functions (Webhook-Handler)
    ↓
Firestore (Lead-Datenbank)
    ↑
React Sales-UI (Echtzeit-Dashboard)
```

### Geschäftsprozess

1. **Gatekeeper-Überwindung**: KI-Agent ruft Firmen an, erkennt Gatekeeper
2. **Sofort-Transfer**: Bei Geschäftsführer-Kontakt → direkter Handover an Sales
3. **Smart Retry**: Automatische Wiederholung bei no-answer/busy
4. **Queue-Management**: 6 Status-Ordner für Lead-Lifecycle
5. **Compliance**: Do-Not-Call-Liste, keine unerwünschten Anrufe

### Tech Stack

- **Backend**: Firebase Functions (TypeScript)
- **Database**: Firestore
- **Frontend**: React + TypeScript (Vite)
- **AI Voice**: ElevenLabs Conversational AI
- **Auth**: Firebase Auth

## Setup-Anleitung

### 1. Firebase Projekt erstellen

```bash
# Firebase CLI installieren
npm install -g firebase-tools

# Einloggen
firebase login

# Neues Projekt erstellen (oder bestehendes nutzen)
firebase projects:create buskoa-ai-prod
```

### 2. Firebase Console Konfiguration

1. Gehe zu [console.firebase.google.com](https://console.firebase.google.com)
2. Wähle dein Projekt
3. Aktiviere folgende Services:
   - **Authentication** → Email/Password aktivieren
   - **Firestore Database** → Produktionsmodus starten
   - **Functions** → Blaze Plan upgrade (für externe API-Calls)

### 3. Firebase Config holen

1. Project Settings → General → Your apps → Web App hinzufügen
2. Config kopieren und in `/web/src/firebase.ts` einfügen:

```typescript
const firebaseConfig = {
  apiKey: "DEIN_API_KEY",
  authDomain: "DEIN_PROJEKT.firebaseapp.com",
  projectId: "DEIN_PROJEKT_ID",
  storageBucket: "DEIN_PROJEKT.appspot.com",
  messagingSenderId: "DEINE_SENDER_ID",
  appId: "DEINE_APP_ID"
}
```

### 4. Dependencies installieren

```bash
# Root directory
npm install

# Functions
cd functions
npm install

# Web UI
cd ../web
npm install
```

### 5. Secrets setzen

```bash
# ElevenLabs Webhook Secret (für Signatur-Verifizierung)
firebase functions:secrets:set ELEVENLABS_WEBHOOK_SECRET

# Sales Telefonnummer für Handover
firebase functions:secrets:set SALES_NUMBER
```

### 6. Deploy

```bash
# Functions deployen
cd functions
npm run deploy

# Oder alles auf einmal
firebase deploy
```

### 7. ElevenLabs Agent konfigurieren

1. Gehe zu [elevenlabs.io/conversational-ai](https://elevenlabs.io/conversational-ai)
2. Erstelle neuen Agent mit:
   - **Language**: German
   - **First Message**: "Guten Tag, mein Name ist Anna von BuskoAI. Könnte ich bitte kurz mit der Geschäftsführung oder der Disposition sprechen?"
   - **System Prompt**: Siehe unten
3. Tools aktivieren:
   - **Transfer to number** → Deine Sales-Nummer
   - **End call**
   - **Voicemail detection**
4. Webhook URL eintragen: `https://YOUR-PROJECT.cloudfunctions.net/elevenLabsWebhook`

### 8. System Prompt für ElevenLabs

```
Du bist Anna, eine professionelle Assistentin von BuskoAI.

DEINE AUFGABE:
1. Höflich nach Geschäftsführung/Disposition fragen
2. Bei Gatekeeper: Kurz erwähnen dass es um Förderprogramm für Fuhrparkbetreiber geht
3. SOFORT weiterleiten wenn Geschäftsführer am Apparat

WICHTIG:
- Maximal 2 Sätze pro Antwort
- Keine Details zum Programm
- Bei Ablehnung: Höflich beenden
- Bei "kein Interesse": Sofort auflegen
```

### 9. Cloud Scheduler für Retry-Jobs

```bash
# Scheduler Job erstellen (alle 15 Min, Mo-Fr 9-17 Uhr)
gcloud scheduler jobs create http dispatch-retries \
  --location=europe-west1 \
  --schedule="*/15 9-17 * * 1-5" \
  --uri="https://YOUR-PROJECT.cloudfunctions.net/dispatchRetries" \
  --http-method=POST \
  --headers="x-cloudscheduler=true" \
  --time-zone="Europe/Berlin"
```

### 10. Sales User anlegen & UI starten

```bash
# Development
cd web
npm run dev
# Browser öffnen: http://localhost:5173

# User registrieren über UI
# Email: sales@buskoa.ai
# Password: [sicheres Passwort]
```

## Deployment Checklist

- [ ] Firebase Projekt erstellt
- [ ] Firestore & Auth aktiviert
- [ ] Firebase Config in `/web/src/firebase.ts`
- [ ] Functions deployed
- [ ] ElevenLabs Agent konfiguriert
- [ ] Webhook URL in ElevenLabs eingetragen
- [ ] Cloud Scheduler Job aktiv
- [ ] Sales User angelegt
- [ ] Test-Anruf durchgeführt

## Wichtige Endpoints

- **Webhook**: `https://[PROJECT].cloudfunctions.net/elevenLabsWebhook`
- **Retry Job**: `https://[PROJECT].cloudfunctions.net/dispatchRetries`
- **Manual Call**: `https://[PROJECT].cloudfunctions.net/startCall`
- **Stats**: `https://[PROJECT].cloudfunctions.net/getStats`

## Monitoring

```bash
# Functions Logs
firebase functions:log

# Oder spezifisch
firebase functions:log --only elevenLabsWebhook
```

## Troubleshooting

### Functions Deploy fehlschlägt
```bash
# Node Version checken (muss 18+ sein)
node --version

# TypeScript Build manuell
cd functions
npm run build
```

### Webhook empfängt keine Events
1. Prüfe Webhook URL in ElevenLabs
2. Teste mit curl:
```bash
curl -X POST https://YOUR-PROJECT.cloudfunctions.net/elevenLabsWebhook \
  -H "Content-Type: application/json" \
  -d '{"type":"test","leadId":"test123","phone":"+49123456789"}'
```

### Firestore Permissions Error
```bash
# Rules neu deployen
firebase deploy --only firestore:rules
```

## Lizenz & Compliance

- **DSGVO-konform**: Keine Aufzeichnungen ohne Einwilligung
- **Do-Not-Call**: Automatische Sperrung bei Wunsch
- **Geschäftszeiten**: Mo-Fr 9-17 Uhr
- **Rate Limiting**: Max 10 Calls parallel