(function setupDomUtils() {
  'use strict';

  const ns = window.Medha || (window.Medha = {});

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `medha-notification medha-notification-${type || 'info'}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  ns.escapeHtml = escapeHtml;
  ns.showNotification = showNotification;
})();


