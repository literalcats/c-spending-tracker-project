/* =====================================================================
   ui/install.js — the "Install app" button (PWA install).
   HOW IT WORKS:
     - Chrome/Edge/Android fire a `beforeinstallprompt` event when the
       app CAN be installed. We save it and show our own install button.
     - iPhone/iPad Safari has no such event, so we show the button and
       explain "Share → Add to Home Screen".
     - Any element with data-click="install" is an install button; the
       CSS shows them only when <html data-installable="true">.
   ===================================================================== */
import { toast } from './toast.js';

let deferredPrompt = null;
const root = document.documentElement;

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function initInstall() {
  if (isStandalone()) return; // already installed → keep buttons hidden

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();          // stop the browser's own mini-bar
    deferredPrompt = e;          // keep it so OUR button can trigger it later
    root.dataset.installable = 'true';
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    delete root.dataset.installable;
    toast('App installed');
  });
  if (isIOS()) root.dataset.installable = 'true';
}

// Called when the user taps an install button.
export async function promptInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;   // wait for Install / Cancel
    deferredPrompt = null;
    delete root.dataset.installable;
  } else if (isIOS()) {
    toast('Tap Share, then "Add to Home Screen".');
  }
}
