
FCM Notifications Pack (client helpers + Cloud Functions)

FILES
- functions/index.js            -> callable sendPush (targeting) + sendPushToAll (compat)
- functions/package.json
- client/push-fcm.js            -> helper functions: PushFCM.enable/disable/updatePresence
- firebase-messaging-sw.js      -> service worker template (YOU MUST paste your firebaseConfig)

WHAT YOU MUST DO
1) Firebase Console -> Project settings -> Cloud Messaging -> Web Push certificates -> Generate key pair
   Copy the PUBLIC VAPID key

2) Realtime Database -> create:
   /config/vapidKey = "<PUBLIC_VAPID_KEY>"

3) Service worker:
   - Put firebase-messaging-sw.js at the ROOT of your hosting (same level as index.html)
   - Replace the firebase.initializeApp({...}) config in the SW with your real config

4) Front scripts (add if missing):
   - firebase-messaging-compat.js
   - (optional for admin UI calling functions) firebase-functions-compat.js
   Then include client/push-fcm.js, and wire your toggle:
     PushFCM.enable()  /  PushFCM.disable()

5) Deploy functions (requires Blaze already enabled):
   cd functions
   npm install
   firebase deploy --only functions

Recommended RTDB rules (do NOT copy blindly without checking your current rules)
- Deny reads on fcmTokens from clients
- Allow user to write their own token entries
- Only admins can read all users list
