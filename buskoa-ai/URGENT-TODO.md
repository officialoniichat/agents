# ⚠️ DRINGEND - Blaze Plan Upgrade erforderlich!

## Problem:
Firebase Functions können NICHT ohne Blaze Plan (Pay-as-you-go) deployed werden!

## Lösung (2 Minuten):

### 1. Upgrade auf Blaze Plan
👉 **JETZT ÖFFNEN:** https://console.firebase.google.com/project/bussales-80225/usage/details

- Klicke "Upgrade to Blaze"
- Füge Zahlungsmethode hinzu
- **KEINE SORGE:** Erste $300 Credits sind kostenlos!
- Für dein Projekt: ~$0 bis max $5/Monat bei normalem Gebrauch

### 2. Nach dem Upgrade - Functions deployen:
```bash
cd /Users/danielkashi/Desktop/CallAgent/buskoa-ai/functions
npm run deploy
```

### 3. Webhook URL notieren:
Nach erfolgreichem Deploy siehst du:
```
Function URL (handleElevenLabsWebhook): https://europe-west1-bussales-80225.cloudfunctions.net/handleElevenLabsWebhook
```

Diese URL in ElevenLabs eintragen!

## Alternative für SOFORT-Test (ohne Functions):

### Local Emulator starten:
```bash
cd /Users/danielkashi/Desktop/CallAgent/buskoa-ai
firebase emulators:start --only firestore,auth

# Neues Terminal:
cd web
npm run dev
```

Dann kannst du zumindest das Dashboard testen (aber keine echten Calls!)

## Node.js Version Problem (Optional):

Dein Node ist zu alt (v18). Für optimale Performance:
```bash
# Mit Homebrew:
brew install node@20

# Oder mit nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

---

## ✅ Was funktioniert OHNE Blaze Plan:
- Firestore Database ✅
- Authentication ✅  
- Web UI Dashboard ✅

## ❌ Was NICHT funktioniert ohne Blaze:
- Cloud Functions (Webhook Handler) ❌
- Outbound Calls zu ElevenLabs ❌
- Automatische Retry-Jobs ❌

**Fazit:** Ohne Blaze Plan kannst du nur das Dashboard ansehen, aber keine Calls machen!