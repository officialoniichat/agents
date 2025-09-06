# 🔧 Firebase Auth Fix

## Problem:
Firebase Authentication ist nicht aktiviert!

## Lösung (1 Minute):

### 1. Firebase Console öffnen:
👉 https://console.firebase.google.com/project/bussales-80225/authentication

### 2. Authentication aktivieren:
- Klicke "Get started"
- Wähle "Email/Password" 
- Toggle "Enable" → AN
- Toggle "Email link (passwordless sign-in)" → AUS lassen
- Klicke "Save"

### 3. Optional: Test-User direkt anlegen
- In Firebase Console → Authentication → Users
- "Add user"
- Email: sales@buskoa.de
- Password: [sicheres password]

### 4. Web UI neu laden:
- Browser: http://localhost:5173
- Jetzt sollte Register/Login funktionieren!

## Alternative: Firestore Rules temporär öffnen

Wenn du SOFORT testen willst ohne Auth:

```javascript
// firestore.rules - NUR FÜR TEST!
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // UNSICHER - NUR FÜR TEST!
    }
  }
}
```

Dann deploy:
```bash
firebase deploy --only firestore:rules
```

⚠️ **WICHTIG:** Nach dem Test wieder auf sichere Rules zurück!