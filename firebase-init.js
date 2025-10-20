// Firebase client initialization using the provided config
(function(){
  if (window.firebase && firebase.apps && firebase.apps.length) return;
  const firebaseConfig = {
    apiKey: "AIzaSyBQrPvDsOABSa4_RmlVaOe5tseYV3cTqc4",
    authDomain: "birthday-bot-website.firebaseapp.com",
    databaseURL: "https://birthday-bot-website-default-rtdb.firebaseio.com",
    projectId: "birthday-bot-website",
    storageBucket: "birthday-bot-website.firebasestorage.app",
    messagingSenderId: "461756013803",
    appId: "1:461756013803:web:4b629ef56086ff10a432ae",
    measurementId: "G-2GJ3XV451W"
  };
  if (!window.firebase || !firebase.initializeApp) {
    console.warn('Firebase SDK not loaded yet');
    return;
  }
  firebase.initializeApp(firebaseConfig);
  // Sign in anonymously for per-user doc permissions
  if (firebase.auth) {
    firebase.auth().signInAnonymously().catch(console.warn);
  }
  // Expose Firestore handle globally with network safety settings
  if (firebase.firestore) {
    try {
      const fs = firebase.firestore();
      fs.settings({
        experimentalAutoDetectLongPolling: true,
        useFetchStreams: false,
        merge: true
      });
      window._firestore = fs;
    } catch (e) { }
  }
})();
