importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAGaitqmFwExvJ9ZUpkdUdCKAqqDOP2cdQ",
  authDomain: "objectif-restaurant.firebaseapp.com",
  databaseURL: "https://objectif-restaurant-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "objectif-restaurant",
  storageBucket: "objectif-restaurant.firebasestorage.app",
  messagingSenderId: "910113283000",
  appId: "1:910113283000:web:0951fd9dca01aa6e46cd4d"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background message:', payload);
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'Nouvelle notification', {
    body: body || '',
    icon: icon || '/icon-192.jpg',
    badge: '/icon-192.jpg',
    vibrate: [200, 100, 200],
    tag: 'lafayette-notif'
  });
});
