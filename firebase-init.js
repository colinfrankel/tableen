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
  // Keep the anonymous auth session across reloads in the browser.
  if (firebase.auth) {
    const auth = firebase.auth();
    try {
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
      auth.onAuthStateChanged((user) => {
        try {
          if (user && window.localStorage) {
            window.localStorage.setItem('tableen-auth-uid', user.uid);
          }
        } catch (e) {}
      });
    } catch (e) {
      console.warn('Firebase auth persistence setup failed:', e);
    }
    auth.signInAnonymously().catch((err) => {
      console.warn('Anonymous sign-in skipped or blocked:', err);
    });
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
