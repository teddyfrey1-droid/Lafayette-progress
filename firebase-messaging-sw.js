// Firebase requires a firebase-messaging-sw.js at the root for Web Push.
// We keep a single service worker by importing our main SW implementation.
importScripts('./sw.js');
