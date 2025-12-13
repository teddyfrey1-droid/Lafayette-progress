/* ============================================
   CONFIG & GLOBALS - Heiko Dashboard Lafayette
   ============================================ */

// Firebase configuration (user-provided)
const firebaseConfig = {
  apiKey: "AIzaSyAGaitqmFwExvJ9ZUpkdUdCKAqqDOP2cdQ",
  authDomain: "objectif-restaurant.firebaseapp.com",
  databaseURL: "https://objectif-restaurant-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "objectif-restaurant",
  storageBucket: "objectif-restaurant.firebasestorage.app",
  messagingSenderId: "910113283000",
  appId: "1:910113283000:web:0951fd9dca01aa6e46cd4d",
  measurementId: "G-D04VQX87GP"
};

// Initialize Firebase (compat SDK loaded in index.html)
firebase.initializeApp(firebaseConfig);

// Globals
window.auth = firebase.auth();
window.db   = firebase.database();

window.currentUser = null;
window.isAdmin = false;

// Central store
window.globalData = {
  users: {},
  objectives: {},
  planning: {},
  publicUpdates: {}
};

// App settings
window.MONEY_TANK_MAX_EUR = window.MONEY_TANK_MAX_EUR || 100; // default max for money tank
