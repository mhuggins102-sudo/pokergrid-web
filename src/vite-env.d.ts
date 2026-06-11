/// <reference types="vite/client" />

// Injected by vite.config.ts `define` — short git sha + build date,
// shown in Settings so a device's running build is verifiable (the
// PWA serves cached assets until its service worker updates).
declare const __BUILD_ID__: string;
