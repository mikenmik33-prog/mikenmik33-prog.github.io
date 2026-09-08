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
    apiKey: "AIzaSyBMxYxC9APd5eWfU8b-q5DDCE_9bPxVV8E",
    authDomain: "info-eab91.firebaseapp.com",
    projectId: "info-eab91",
    storageBucket: "info-eab91.firebasestorage.app",
    messagingSenderId: "393273032281",
    appId: "1:393273032281:web:dc814891e66d404b13fb48"
};
