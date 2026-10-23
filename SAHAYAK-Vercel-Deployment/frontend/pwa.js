(() => {
  'use strict';
  const SW_PATH = '/service-worker.js';

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(SW_PATH).catch(error => {
        console.warn('SAHAYAK offline shell could not be enabled:', error);
      });
    }, { once: true });
  }

  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    updateInstallButtons(true);
  });

  function updateInstallButtons(show) {
    document.querySelectorAll('[data-sahayak-install]').forEach(button => {
      button.hidden = !show;
    });
  }

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    updateInstallButtons(false);
    document.querySelectorAll('[data-sahayak-install-status]').forEach(el => {
      el.textContent = 'SAHAYAK is installed on this device.';
    });
  });

  async function installApp() {
    const status = document.querySelector('[data-sahayak-install-status]');
    if (!installPrompt) {
      if (status) status.textContent = 'On Android, open this site in Chrome, tap the three-dot menu, then choose Install app or Add to Home screen.';
      return;
    }
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    updateInstallButtons(false);
  }

  function setupInstallUI() {
    if (document.querySelector('[data-sahayak-install]')) {
      document.querySelectorAll('[data-sahayak-install]').forEach(button => {
        button.addEventListener('click', installApp);
      });
      return;
    }

    const container = document.createElement('div');
    container.id = 'sahayak-pwa-install-bar';
    container.style.cssText = 'position:fixed;z-index:9999;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));display:flex;gap:8px;align-items:center;max-width:calc(100vw - 28px);font:600 14px system-ui,sans-serif;';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Install SAHAYAK';
    button.setAttribute('data-sahayak-install', '');
    button.style.cssText = 'border:0;border-radius:999px;padding:12px 16px;background:#ff9933;color:#08111f;box-shadow:0 6px 24px #0006;cursor:pointer;min-height:44px;';
    button.hidden = true;
    button.addEventListener('click', installApp);

    const status = document.createElement('span');
    status.setAttribute('data-sahayak-install-status', '');
    status.setAttribute('role', 'status');
    status.style.cssText = 'max-width:230px;padding:8px 10px;border-radius:10px;background:#111e31;color:#f4f7fb;display:none;';

    button.addEventListener('click', () => { status.style.display = 'block'; });
    container.append(button, status);
    document.body.append(container);

    // If Chrome doesn't offer the install event, make an install-help button available
    // only when not already running as a standalone app.
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (!standalone) {
      button.hidden = false;
      button.addEventListener('click', () => {
        if (!installPrompt) status.style.display = 'block';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupInstallUI, { once: true });
  } else {
    setupInstallUI();
  }
})();
