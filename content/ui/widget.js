(function setupWidgetUI() {
  'use strict';

  const ns = window.Medha || (window.Medha = {});
  const { state } = ns;
  const { escapeHtml, showNotification } = ns;
  const { getCurrentTime, getVideoPlayer, formatTime } = ns.youtube;

  function updateCurrentTime() {
    setInterval(() => {
      const timeDisplay = document.getElementById('current-time');
      if (timeDisplay) { timeDisplay.textContent = getCurrentTime(); }
    }, 1000);
  }

  function switchTab(tabName) {
    document.querySelectorAll('.medha-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    document.querySelectorAll('.medha-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
      content.classList.toggle('hidden', content.id !== `tab-${tabName}`);
    });
    if (tabName === 'chat') {
      ns.features && ns.features.loadChatHistory && ns.features.loadChatHistory();
      requestAnimationFrame(() => {
        ns.features && ns.features.scrollChatToBottom && ns.features.scrollChatToBottom();
        setTimeout(() => ns.features && ns.features.scrollChatToBottom && ns.features.scrollChatToBottom(), 100);
        setTimeout(() => ns.features && ns.features.scrollChatToBottom && ns.features.scrollChatToBottom(), 300);
        setTimeout(() => ns.features && ns.features.scrollChatToBottom && ns.features.scrollChatToBottom(), 500);
        setTimeout(() => ns.features && ns.features.scrollChatToBottom && ns.features.scrollChatToBottom(), 800);
      });
    } else if (tabName === 'notes') {
      ns.features && ns.features.loadNotes && ns.features.loadNotes();
    } else if (tabName === 'quiz') {
      ns.features && ns.features.loadQuizzes && ns.features.loadQuizzes();
      // Populate default times if empty
      const toInput = document.getElementById('quiz-to-time');
      if (toInput && !toInput.value) {
          const player = ns.youtube && ns.youtube.getVideoPlayer ? ns.youtube.getVideoPlayer() : null;
          const duration = player ? player.duration : 0;
          if (duration > 0 && ns.youtube.formatTime) {
              toInput.value = ns.youtube.formatTime(Math.floor(duration));
          }
      }
    }
  }


  function attachEventListeners() {
    document.getElementById('medha-minimize').addEventListener('click', toggleMinimize);

    // Fuel the Mission button
    document.getElementById('medha-fuel-mission').addEventListener('click', () => {
      if (ns.features && ns.features.showFuelMissionModal) {
        ns.features.showFuelMissionModal();
      }
    });
    loadAndSetupGroupSelector();
    document.getElementById('medha-remove-image')?.addEventListener('click', () => ns.features && ns.features.removeImage && ns.features.removeImage());
    document.getElementById('medha-chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') ns.features && ns.features.sendChatMessage && ns.features.sendChatMessage(); });
    document.getElementById('medha-send-chat')?.addEventListener('click', () => ns.features && ns.features.sendChatMessage && ns.features.sendChatMessage());
    document.getElementById('medha-generate-quiz')?.addEventListener('click', () => ns.features && ns.features.generateQuiz && ns.features.generateQuiz());
    document.querySelectorAll('.medha-tab').forEach(tab => { tab.addEventListener('click', () => switchTab(tab.dataset.tab)); });
    document.getElementById('medha-add-note').addEventListener('click', () => ns.features && ns.features.addNote && ns.features.addNote());
    document.getElementById('medha-voice-btn').addEventListener('click', () => ns.features && ns.features.toggleVoiceRecording && ns.features.toggleVoiceRecording());
    
    // Chat voice input
    const chatVoiceBtn = document.getElementById('medha-chat-voice-btn');
    if (chatVoiceBtn) {
      chatVoiceBtn.addEventListener('click', () => ns.features && ns.features.toggleVoiceRecording && ns.features.toggleVoiceRecording('medha-chat-voice-btn', 'medha-chat-input'));
    }
    
    document.getElementById('medha-rewrite-btn').addEventListener('click', () => ns.features && ns.features.rewriteNote && ns.features.rewriteNote());

    // Image upload handlers
    const imageUpload = document.getElementById('medha-image-upload');
    const imageBtn = document.getElementById('medha-image-btn');

    if (imageUpload) {
      imageUpload.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file && ns.features && ns.features.processImageFile) {
          ns.features.processImageFile(file);
        }
        e.target.value = '';
      });
    }

    // Handle button click to trigger file input
    if (imageBtn && imageUpload) {
      imageBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        imageUpload.click();
      });
    }

    // Screenshot handler
    const screenshotBtn = document.getElementById('medha-screenshot-btn');
    if (screenshotBtn) {
      screenshotBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const widget = document.getElementById('medha-widget');
        const fab = document.getElementById('medha-fab');
        const wasMinimized = state.isMinimized;

        // Hide UI
        if (widget) widget.style.display = 'none';
        if (fab) fab.style.display = 'none';

        // Wait for DOM to update
        await new Promise(r => setTimeout(r, 100));

        try {
          const response = await chrome.runtime.sendMessage({ action: 'takeScreenshot' });

          // Show UI back
          if (widget && !wasMinimized) widget.style.display = 'flex';
          if (fab && wasMinimized) fab.style.display = 'flex';
          else if (fab && !wasMinimized && window.Medha.ui && window.Medha.ui.createFloatingIcon) {
            // In case fab needs to be shown based on logic
          }

          if (response && response.dataUrl) {
            if (ns.features && ns.features.processScreenshot) {
              ns.features.processScreenshot(response.dataUrl);
            }
          } else if (response && response.error) {
            showNotification && showNotification('❌ Screenshot failed: ' + response.error, 'error');
          } else {
            showNotification && showNotification('❌ Failed to capture screenshot', 'error');
          }
        } catch (err) {
          // Show UI back on error
          if (widget && !wasMinimized) widget.style.display = 'flex';
          if (fab && wasMinimized) fab.style.display = 'flex';
          showNotification && showNotification('❌ Screenshot error: ' + err.message, 'error');
        }
      });
    }

    const removeImageBtn = document.getElementById('medha-remove-image');
    if (removeImageBtn) {
      removeImageBtn.addEventListener('click', () => {
        if (ns.features && ns.features.removeImage) {
          ns.features.removeImage();
        }
      });
    }

    // Drag and drop handlers
    const noteInputArea = document.querySelector('[data-note-input-area]');
    if (noteInputArea) {
      noteInputArea.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
          noteInputArea.classList.add('medha-dragging');
        }
      });
      noteInputArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      noteInputArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        noteInputArea.classList.remove('medha-dragging');
      });
      noteInputArea.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        noteInputArea.classList.remove('medha-dragging');
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/') && ns.features && ns.features.processImageFile) {
          ns.features.processImageFile(files[0]);
        }
      });
    }

    // Paste handler
    const noteInput = document.getElementById('medha-note-input');
    noteInput.addEventListener('focus', () => { ns.youtube.pauseVideo(); state.isUserTyping = true; });
    noteInput.addEventListener('input', () => {
      if (!state.isUserTyping) { ns.youtube.pauseVideo(); state.isUserTyping = true; }
      if (state.typingTimer) { clearTimeout(state.typingTimer); }
      state.typingTimer = setTimeout(() => { state.isUserTyping = false; ns.youtube.resumeVideo(); }, 2000);
    });
    noteInput.addEventListener('blur', () => {
      if (state.typingTimer) { clearTimeout(state.typingTimer); }
      setTimeout(() => { if (!state.isUserTyping && !state.isRecording) { ns.youtube.resumeVideo(); } }, 500);
    });
    noteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        ns.features && ns.features.addNote && ns.features.addNote();
      }
    });
    noteInput.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file && ns.features && ns.features.processImageFile) {
            ns.features.processImageFile(file);
          }
          break;
        }
      }
    });

    document.getElementById('medha-send-chat').addEventListener('click', () => ns.features && ns.features.sendChatMessage && ns.features.sendChatMessage());
    const chatInput = document.getElementById('medha-chat-input');
    chatInput.addEventListener('focus', () => { ns.youtube.pauseVideo(); state.isUserTyping = true; });
    chatInput.addEventListener('input', () => {
      if (!state.isUserTyping) { ns.youtube.pauseVideo(); state.isUserTyping = true; }
      if (state.typingTimer) { clearTimeout(state.typingTimer); }
      state.typingTimer = setTimeout(() => { state.isUserTyping = false; ns.youtube.resumeVideo(); }, 2000);
    });
    chatInput.addEventListener('blur', () => {
      if (state.typingTimer) { clearTimeout(state.typingTimer); }
      setTimeout(() => { if (!state.isUserTyping && !state.isRecording) { ns.youtube.resumeVideo(); } }, 500);
    });
    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { ns.features && ns.features.sendChatMessage && ns.features.sendChatMessage(); } });
  }

  async function loadAndSetupGroupSelector() {
    const groupSelect = document.getElementById('medha-group-select'); if (!groupSelect) return;
    try {
      // Fetch actual groups from backend
      const response = await chrome.runtime.sendMessage({ action: 'getGroups' });
      const groups = (response && response.data) ? response.data : [];

      // We will store the current group id instead of the string 'general' or name
      groupSelect.innerHTML = `
        <option value="general">General</option>
        ${groups.map(g => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.group_name)}</option>`).join('')}
        <option value="__custom__">+ Add New Group</option>
      `;

      const currentGroupId = state.currentTutorialGroup || 'general';
      groupSelect.value = currentGroupId;

      // If the current group ID doesn't exist in the list (e.g. deleted or invalid), fallback to general
      if (groupSelect.value !== currentGroupId && currentGroupId !== 'general') {
        groupSelect.value = 'general';
        state.currentTutorialGroup = 'general';
      }

      groupSelect.addEventListener('change', async (e) => {
        if (e.target.value === '__custom__') {
          const newGroupName = prompt('Enter new group name:');
          if (newGroupName && newGroupName.trim()) {
            await createAndAssignGroup(newGroupName.trim());
          } else {
            groupSelect.value = state.currentTutorialGroup || 'general';
          }
        } else {
          await updateTutorialGroup(e.target.value);
        }
      });
    } catch (error) {
      console.error('Failed to load groups:', error);
      groupSelect.innerHTML = `<option value="${escapeHtml(state.currentTutorialGroup || 'general')}">Error loading groups</option>`;
      groupSelect.value = state.currentTutorialGroup || 'general';
    }
  }

  async function createAndAssignGroup(groupName) {
    if (!state.currentTutorialId || !groupName) return;
    const groupSelect = document.getElementById('medha-group-select');
    const oldGroupId = state.currentTutorialGroup;
    try {
      // 1. Create the group
      const newGroup = await chrome.runtime.sendMessage({ action: 'createGroup', data: { groupName } });
      const newGroupId = newGroup.id;

      // 2. Assign the tutorial
      await updateTutorialGroup(newGroupId);
    } catch (error) {
      showNotification && showNotification('❌ Failed to create group: ' + error.message, 'error');
      state.currentTutorialGroup = oldGroupId;
      groupSelect.value = oldGroupId;
    }
  }

  async function updateTutorialGroup(newGroupId) {
    if (!state.currentTutorialId || !newGroupId) return;
    const groupSelect = document.getElementById('medha-group-select');
    const oldGroupId = state.currentTutorialGroup;
    try {
      await chrome.runtime.sendMessage({ action: 'assignTutorial', data: { tutorialId: state.currentTutorialId, groupId: newGroupId } });
      state.currentTutorialGroup = newGroupId;

      const videoUrl = window.Medha.youtube.getNormalizedYouTubeUrl();
      if (!videoUrl) return;

      const saved = await chrome.storage.local.get([`tutorial_${videoUrl}`]);
      if (saved[`tutorial_${videoUrl}`]) {
        saved[`tutorial_${videoUrl}`].group_id = newGroupId;
        await chrome.storage.local.set(saved);
      }

      // Reload groups to update UI and dropdown (in case it was a new custom group)
      await loadAndSetupGroupSelector();

      showNotification && showNotification(' Group assigned successfully!', 'success');
    } catch (error) {
      showNotification && showNotification('❌ Failed to assign group: ' + error.message, 'error');
      state.currentTutorialGroup = oldGroupId;
      groupSelect.value = oldGroupId;
    }
  }

  function createFloatingWidget(tutorialTitle) {
    if (document.getElementById('medha-widget')) return;
    const widget = document.createElement('div'); widget.id = 'medha-widget'; widget.className = 'medha-widget';
    widget.innerHTML = `
      <div class="medha-header">
        <div class="medha-header-title">
          <span class="medha-logo"><img src="${chrome.runtime.getURL('assets/logo.png')}" alt="Medha.ai" style="width: 100%; height: 100%; object-fit: contain;" /></span>
          <div class="medha-title-text">
            <div class="medha-brand">Note Tube</div>
            <div class="medha-session-info">
              <div class="medha-session-group-container">
                <span class="medha-group-label">Group:</span>
                <select id="medha-group-select" class="medha-group-select"><option value="">Loading...</option></select>
              </div>
            </div>
          </div>
        </div>
        <div class="medha-header-actions">
          <button id="medha-fuel-mission" class="medha-header-btn" title="Support Us"><img src="${chrome.runtime.getURL('assets/donate.png')}" alt="Donate" style="width: 18px; height: 18px; object-fit: contain;" /></button>
          <button id="medha-minimize" class="medha-header-btn" title="Minimize"><span class="icon">−</span></button>
        </div>
      </div>
      <div class="medha-body">
        <div class="medha-tabs">
          <button class="medha-tab active" data-tab="notes"><span class="tab-icon"></span> Notes</button>
          <button class="medha-tab" data-tab="chat"><span class="tab-icon"></span> Chat</button>
          <button class="medha-tab" data-tab="quiz"><span class="tab-icon"></span> Quiz</button>
        </div>
        <div id="tab-notes" class="medha-tab-content active">
          <div class="medha-note-input-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <div class="medha-time-display"><span class="time-icon">⏱️</span><span>At <span id="current-time" class="time-value">0:00</span></span></div>
              <div class="medha-input-actions" style="position: static; display: flex; gap: 6px; padding: 0; background: transparent;">
                <input type="file" id="medha-image-upload" accept="image/*" style="display: none;" />
                <button type="button" id="medha-screenshot-btn" class="medha-icon-action-btn" title="Take Screenshot"><span class="icon">📸</span></button>
                <button type="button" id="medha-image-btn" class="medha-icon-action-btn" title="Upload Image"><span class="icon">🖼️</span></button>
                <button id="medha-voice-btn" class="medha-icon-action-btn" title="Voice Input"><span class="icon">🎤</span></button>
                <button id="medha-rewrite-btn" class="medha-icon-action-btn" title="Enhance with AI"><span class="icon">✨</span></button>
              </div>
            </div>
            <div class="medha-input-wrapper" data-note-input-area>
              <textarea id="medha-note-input" class="medha-textarea-modern" placeholder="What's important here? Jot it down...." rows="3" autocomplete="off"></textarea>
            </div>
            <div id="medha-image-preview" class="medha-image-preview" style="display: none;">
              <img id="medha-preview-img" src="" alt="Preview" style="max-width: 100%; max-height: 150px; border-radius: 8px; margin-top: 8px;" />
              <button id="medha-remove-image" class="medha-remove-image-btn" title="Remove">×</button>
            </div>
            <button id="medha-add-note" class="medha-btn-modern medha-btn-primary">Add Note</button>
          </div>
          <div id="medha-notes-list" class="medha-notes-list"><div class="medha-empty-state"><div class="medha-empty-icon"></div><div class="medha-empty-text">No notes yet. Start taking notes!</div></div></div>
        </div>
        <div id="tab-chat" class="medha-tab-content">
          <div class="medha-chat-container">
            <div id="medha-chat-messages" class="medha-chat-messages"><div class="medha-empty-state"><div class="medha-empty-icon"></div><div class="medha-empty-text">Ask me anything about this tutorial!</div></div></div>
            <div class="medha-chat-input-container">
              <div style="position: relative; flex: 1; display: flex; align-items: center;">
                <input id="medha-chat-input" class="medha-chat-input" placeholder="Ask a question about the video..." type="text" style="width: 100%; padding-right: 36px; box-sizing: border-box;" autocomplete="off" />
                <button id="medha-chat-voice-btn" class="medha-icon-action-btn" title="Voice Input" style="position: absolute; right: 4px; background: transparent; border: none; padding: 6px;"><span class="icon">🎤</span></button>
              </div>
              <button id="medha-send-chat" class="medha-send-btn"><span class="icon">→</span></button>
            </div>
          </div>
        </div>
        <div id="tab-quiz" class="medha-tab-content">
          <div class="medha-quiz-container">
            <div class="medha-quiz-header-controls" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #ffffff;">Generate Quiz</h3>
              <p style="margin: 0 0 16px 0; font-size: 13px; color: #a0a0a0; line-height: 1.4;">
                Create a practice test from any section of the video.<br/>
                Timestamps define the content range for quiz generation.
              </p>
              
              <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                <div style="flex: 1;">
                  <label style="display: block; color: #a0a0a0; font-size: 12px; margin-bottom: 6px;">From</label>
                  <input type="text" id="quiz-from-time" class="medha-input-sm" style="width: 100%; box-sizing: border-box; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; color: #fff; padding: 8px 12px; font-size: 14px;" value="0:00" placeholder="0:00" />
                </div>
                <div style="flex: 1;">
                  <label style="display: block; color: #a0a0a0; font-size: 12px; margin-bottom: 6px;">To</label>
                  <input type="text" id="quiz-to-time" class="medha-input-sm" style="width: 100%; box-sizing: border-box; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; color: #fff; padding: 8px 12px; font-size: 14px;" placeholder="End" />
                </div>
              </div>
              
              <button id="medha-generate-quiz" class="medha-btn-primary" style="width: 100%; padding: 10px; font-size: 14px; font-weight: 500; border-radius: 6px; background-color: #6366f1; color: white; border: none; cursor: pointer; transition: background-color 0.2s;">Generate Quiz</button>
            </div>
            
            <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); margin: 24px 0;"></div>
            
            <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #818cf8;">Previous Quizzes</h3>
            <div id="medha-quiz-list" class="medha-quiz-list">
              <div class="medha-empty-state"><div class="medha-empty-icon">📝</div><div class="medha-empty-text">No quizzes yet. Generate one!</div></div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(widget);
    attachEventListeners(); updateCurrentTime();
  }

  function toggleMinimize() {
    const widget = document.getElementById('medha-widget'); if (!widget) return;
    if (state.isMinimized) {
      widget.style.display = 'flex';
      const fab = document.getElementById('medha-fab'); if (fab) fab.remove();
      state.isMinimized = false;
      const body = widget.querySelector('.medha-body');
      if (body) body.scrollTop = 0;
    } else {
      widget.style.display = 'none'; window.Medha.ui && window.Medha.ui.createFloatingIcon && window.Medha.ui.createFloatingIcon(); state.isMinimized = true;
    }
  }

  function closeWidget() {
    const widget = document.getElementById('medha-widget'); if (widget) widget.remove();
    const fab = document.getElementById('medha-fab'); if (fab) fab.remove();
    state.isMinimized = false;
  }

  ns.ui = ns.ui || {};
  ns.ui.createFloatingWidget = createFloatingWidget;
  ns.ui.toggleMinimize = toggleMinimize;
  ns.ui.switchTab = switchTab;
  ns.ui.updateCurrentTime = updateCurrentTime;
  ns.ui.closeWidget = closeWidget;
  ns.ui.loadAndSetupGroupSelector = loadAndSetupGroupSelector;
  ns.ui.updateTutorialGroup = updateTutorialGroup;
})();


