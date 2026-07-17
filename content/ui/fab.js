(function setupFabUI() {
  'use strict';

  const ns = window.Medha || (window.Medha = {});
  const { showNotification } = ns;

  function applyFabSize(fab, size) {
    fab.classList.remove('medha-fab-small', 'medha-fab-medium', 'medha-fab-large');
    switch (size) {
      case 'small': fab.classList.add('medha-fab-small'); break;
      case 'medium': fab.classList.add('medha-fab-medium'); break;
      case 'large': break;
    }
  }

  function makeResizable(fab) {
    const resizeHandle = fab.querySelector('.medha-fab-resize-handle');
    if (!resizeHandle) return;
    let isResizing = false; let startX, startY, startSize;
    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      isResizing = true; startX = e.clientX; startY = e.clientY; startSize = fab.offsetWidth;
      fab.classList.add('resizing'); document.body.style.cursor = 'nwse-resize';
      const onMouseMove = (e2) => {
        if (!isResizing) return;
        const delta = Math.max(e2.clientX - startX, e2.clientY - startY);
        let newSize = Math.max(40, Math.min(100, startSize + delta));
        fab.style.width = newSize + 'px'; fab.style.height = newSize + 'px';
        fab.classList.remove('medha-fab-small', 'medha-fab-medium', 'medha-fab-large');
      };
      const onMouseUp = () => {
        if (isResizing) {
          isResizing = false; fab.classList.remove('resizing'); document.body.style.cursor = '';
          const customSize = fab.offsetWidth; fab.dataset.size = 'custom';
          try {
            chrome.storage.local.set({ fabSize: 'custom', fabCustomSize: customSize });
          } catch (err) {
            console.warn('Extension context invalidated, cannot save FAB size:', err);
          }
          showNotification && showNotification(`FAB size set to ${customSize}px`, 'success');
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        }
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
    fab.addEventListener('mouseenter', () => { resizeHandle.style.opacity = '1'; });
    fab.addEventListener('mouseleave', () => { if (!fab.classList.contains('resizing')) resizeHandle.style.opacity = '0'; });
  }

  function makeDraggable(element) {
    let isDragging = false; let hasMoved = false; let startX, startY, startLeft, startTop;
    element.addEventListener('mousedown', (e) => {
      if (e.target.closest('.medha-fab-tooltip')) return;
      isDragging = true; hasMoved = false;
      const rect = element.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY; startLeft = rect.left; startTop = rect.top;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX; const deltaY = e.clientY - startY;
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        if (!hasMoved) { hasMoved = true; element.classList.add('dragging'); }
        const newLeft = startLeft + deltaX; const newTop = startTop + deltaY;
        const maxX = window.innerWidth - element.offsetWidth; const maxY = window.innerHeight - element.offsetHeight;
        element.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px';
        element.style.top = Math.max(0, Math.min(newTop, maxY)) + 'px';
        element.style.right = 'auto'; element.style.bottom = 'auto';
      }
    });
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        if (hasMoved) {
          try {
            chrome.storage.local.set({ fabPosition: { top: element.style.top, left: element.style.left, right: element.style.right, bottom: element.style.bottom } });
          } catch (err) {
            console.warn('Extension context invalidated, cannot save FAB position:', err);
          }
          setTimeout(() => { element.classList.remove('dragging'); hasMoved = false; }, 100);
        } else { hasMoved = false; }
      }
    });
  }

  function showFabSizeMenu(fab, x, y) {
    const existing = document.getElementById('medha-fab-size-menu'); if (existing) existing.remove();
    const menu = document.createElement('div');
    menu.id = 'medha-fab-size-menu'; menu.className = 'medha-fab-size-menu';
    menu.style.position = 'fixed'; menu.style.left = x + 'px'; menu.style.top = y + 'px'; menu.style.zIndex = '10000000';
    const currentSize = fab.dataset.size || 'large'; const customSize = fab.offsetWidth;
    menu.innerHTML = `
      <div class="medha-size-menu-header">FAB Size</div>
      <button class="medha-size-option ${currentSize === 'small' ? 'active' : ''}" data-size="small"><span class="size-indicator small"></span> Small (48px)</button>
      <button class="medha-size-option ${currentSize === 'medium' ? 'active' : ''}" data-size="medium"><span class="size-indicator medium"></span> Medium (54px)</button>
      <button class="medha-size-option ${currentSize === 'large' ? 'active' : ''}" data-size="large"><span class="size-indicator large"></span> Large (60px)</button>
      ${currentSize === 'custom' ? `<button class="medha-size-option active" data-size="custom"><span class="size-indicator custom"></span> Custom (${customSize}px)</button>` : ''}
      <div class="medha-size-menu-hint">💡 Drag corner to resize</div>
    `;
    document.body.appendChild(menu);
    menu.querySelectorAll('.medha-size-option').forEach(option => {
      option.addEventListener('click', () => {
        const size = option.dataset.size; if (size === 'custom') { menu.remove(); return; }
        fab.dataset.size = size; fab.style.width = ''; fab.style.height = ''; applyFabSize(fab, size);
        try {
          chrome.storage.local.set({ fabSize: size });
        } catch (err) {
          console.warn('Extension context invalidated, cannot save FAB size:', err);
        }
        menu.remove(); showNotification && showNotification(`FAB size set to ${size}`, 'success');
      });
    });
    setTimeout(() => {
      document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', closeMenu); }
      });
    }, 100);
  }

  function createFloatingIcon() {
    if (document.getElementById('medha-fab')) return;
    const fab = document.createElement('div');
    fab.id = 'medha-fab'; fab.className = 'medha-fab';

    // Wrap chrome API calls in try-catch to handle extension context invalidation
    try {
      chrome.storage.local.get(['fabPosition', 'fabSize', 'fabCustomSize'], (result) => {
        try {
          if (result && result.fabPosition) {
            fab.style.bottom = result.fabPosition.bottom || '';
            fab.style.right = result.fabPosition.right || '';
            fab.style.top = result.fabPosition.top || 'auto';
            fab.style.left = result.fabPosition.left || 'auto';
          }
          if (result && result.fabSize) {
            fab.dataset.size = result.fabSize;
            if (result.fabSize === 'custom' && result.fabCustomSize) {
              fab.style.width = result.fabCustomSize + 'px';
              fab.style.height = result.fabCustomSize + 'px';
            } else {
              applyFabSize(fab, result.fabSize);
            }
          }
        } catch (err) {
          console.warn('Error applying FAB settings:', err);
        }
      });
    } catch (err) {
      console.warn('Extension context invalidated, using defaults:', err);
    }
    const logoUrl = chrome.runtime.getURL('assets/logo.png');
    fab.innerHTML = `
      <div class="medha-fab-icon"><img src="${logoUrl}" alt="Medha.ai" style="width: 100%; height: 100%; object-fit: contain;" /></div>
      <div class="medha-fab-close" title="Close Medha AI">✖</div>
      <div class="medha-fab-resize-handle medha-fab-resize-br"></div>
      <div class="medha-fab-tooltip">Expand Learning Widget<br><small style="font-size: 11px; opacity: 0.8;">Drag corner to resize</small></div>
    `;
    document.body.appendChild(fab);
    makeDraggable(fab); makeResizable(fab);

    const closeBtn = fab.querySelector('.medha-fab-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fab.remove();
        showNotification && showNotification('Medha AI floating icon closed. Refresh the page to bring it back.', 'info');
      });
    }

    fab.addEventListener('click', (e) => {
      if (!fab.classList.contains('dragging') && !fab.classList.contains('resizing')) {
        window.Medha.init && window.Medha.init.createSessionFromFAB && window.Medha.init.createSessionFromFAB();
      }
    });
    fab.addEventListener('contextmenu', (e) => { e.preventDefault(); showFabSizeMenu(fab, e.clientX, e.clientY); });
  }

  ns.ui = ns.ui || {};
  ns.ui.createFloatingIcon = createFloatingIcon;
  ns.ui.applyFabSize = applyFabSize;
  ns.ui.showFabSizeMenu = showFabSizeMenu;
  ns.ui.makeDraggable = makeDraggable;
  ns.ui.makeResizable = makeResizable;
})();


