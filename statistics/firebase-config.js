// Налаштування синхронізації даних між пристроями (хмара Firebase).
//
// Щоб увімкнути синхронізацію:
// 1. Створи проєкт на https://console.firebase.google.com (безкоштовно).
// 2. У розділі Build → Firestore Database натисни "Create database" (режим "production").
// 3. У розділі Build → Authentication → Sign-in method увімкни "Email/Password".
// 4. У Project settings → General → "Your apps" додай Web-застосунок і скопіюй
//    значення нижче з об'єкта firebaseConfig, який тобі покаже Firebase.
// 5. У Firestore Database → Rules встав правила з файлу firestore.rules.txt поруч.
//
// Якщо apiKey нижче лишити без змін ("YOUR_API_KEY"), синхронізація просто
// не увімкнеться і сайт працюватиме як раніше — тільки локально, на цьому пристрої.
window.FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
