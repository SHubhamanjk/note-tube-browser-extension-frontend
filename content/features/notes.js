(function setupNotesFeature() {
  'use strict';

  const ns = window.Medha || (window.Medha = {});
  ns.features = ns.features || {};
  const { state } = ns;
  const { escapeHtml, showNotification } = ns;
  const { getCurrentTime, pauseVideo, resumeVideo, timestampToSeconds } = ns.youtube;

  // Image state
  let currentImages = [];
  let isDragging = false;

  // Process image file (validate and convert to base64)
  function processImageFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      showNotification && showNotification('⚠️ Please upload an image file', 'warning');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showNotification && showNotification('⚠️ Please upload an image smaller than 10MB', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      currentImages.push(reader.result);
      renderImagePreviews();
      showNotification && showNotification('✅ Image ready to be added', 'success');
    };
    reader.onerror = () => {
      showNotification && showNotification('❌ Failed to read image file', 'error');
    };
    reader.readAsDataURL(file);
  }

  function processScreenshot(base64Data) {
    currentImages.push(base64Data);
    renderImagePreviews();
    showNotification && showNotification('✅ Screenshot captured', 'success');
  }

  function renderImagePreviews() {
    const preview = document.getElementById('medha-image-preview');
    if (!preview) return;
    if (currentImages.length === 0) {
      preview.style.display = 'none';
      return;
    }
    preview.style.display = 'flex';
    preview.style.gap = '8px';
    preview.style.flexWrap = 'wrap';
    preview.style.marginTop = '8px';
    preview.innerHTML = currentImages.map((img, index) => `
      <div style="position: relative; display: inline-block;">
        <img src="${img}" style="height: 60px; border-radius: 4px; object-fit: cover;" />
        <button type="button" class="medha-remove-image-btn" data-index="${index}" style="position: absolute; top: -5px; right: -5px; background: red; color: white; border-radius: 50%; border: none; width: 18px; height: 18px; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">×</button>
      </div>
    `).join('');
    
    preview.querySelectorAll('.medha-remove-image-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.index);
        currentImages.splice(idx, 1);
        renderImagePreviews();
      });
    });
  }

  // Remove images
  function removeImage() {
    currentImages = [];
    renderImagePreviews();
    const fileInput = document.getElementById('medha-image-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  }

  async function addNote() {
    if (!state.currentTutorialId) { showNotification && showNotification('⚠️ No tutorial session active', 'warning'); return; }
    const input = document.getElementById('medha-note-input'); 
    const note = input.value.trim();
    if (!note && currentImages.length === 0) { 
      showNotification && showNotification('⚠️ Please enter a note or upload an image', 'warning'); 
      return; 
    }
    const timestamp = getCurrentTime();
    const btn = document.getElementById('medha-add-note'); 
    
    // Optimistic UI Update
    const tempId = 'temp-' + Date.now();
    const tempNote = {
      id: tempId,
      tutorial_id: state.currentTutorialId,
      note_content: note || '',
      media: currentImages.length > 0 ? [...currentImages] : [],
      timestamp: timestamp,
      isSaving: true
    };
    
    state.notes = [tempNote, ...(state.notes || [])];
    renderNotes();
    
    // Save state for rollback if needed
    const savedNoteText = note;
    const savedImages = [...currentImages];
    
    // Clear UI immediately so user can keep typing
    input.value = ''; 
    removeImage();
    state.isUserTyping = false; 
    if (state.typingTimer) clearTimeout(state.typingTimer);
    setTimeout(() => { if (!state.isRecording) resumeVideo(); }, 500);

    // Send API request asynchronously in background
    chrome.runtime.sendMessage({ 
      action: 'addNote', 
      data: { 
        tutorialId: state.currentTutorialId, 
        note: savedNoteText || undefined,
        images: savedImages.length > 0 ? savedImages : undefined,
        timestamp 
      } 
    }).then((response) => {
      showNotification && showNotification('✅ Note saved!', 'success');
      // Replace optimistic note with real note from server
      const idx = state.notes.findIndex(n => n.id === tempId);
      if (idx !== -1 && response && response.id) {
        state.notes[idx] = response;
        renderNotes();
      } else {
        loadNotes(true); // Fallback
      }
    }).catch((error) => {
      // Revert optimistic update
      state.notes = state.notes.filter(n => n.id !== tempId);
      renderNotes();
      
      // Restore input if the user hasn't typed something new
      if (input.value === '') {
        input.value = savedNoteText;
        currentImages = savedImages;
        renderImagePreviews();
      }
      showNotification && showNotification('❌ Failed to save note: ' + error.message, 'error');
    });
  }

  // Image viewer modal
  function showImageModal(imageSrc) {
    const existing = document.getElementById('medha-image-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'medha-image-modal';
    modal.className = 'medha-image-modal';
    
    const img = document.createElement('img');
    img.src = imageSrc;
    img.alt = 'Full size note image';
    img.style.cssText = 'max-width: 100%; max-height: 70vh; object-fit: contain;';
    
    const closeBtn = document.createElement('button');
    closeBtn.id = 'medha-close-image-modal';
    closeBtn.className = 'medha-close-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => modal.remove());
    
    const downloadBtn = document.createElement('button');
    downloadBtn.id = 'medha-download-image';
    downloadBtn.className = 'medha-btn-modern medha-btn-primary';
    downloadBtn.textContent = '⬇ Download';
    downloadBtn.addEventListener('click', async () => {
      try {
        await chrome.runtime.sendMessage({
          action: 'downloadImage',
          data: { url: imageSrc, filename: `note-image-${Date.now()}.png` }
        });
        showNotification && showNotification('✅ Image downloaded!', 'success');
      } catch (error) {
        showNotification && showNotification('❌ Download failed', 'error');
      }
    });
    
    const header = document.createElement('div');
    header.className = 'medha-image-modal-header';
    const title = document.createElement('h3');
    title.textContent = 'Image Preview';
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    const body = document.createElement('div');
    body.className = 'medha-image-modal-body';
    body.appendChild(img);
    
    const footer = document.createElement('div');
    footer.className = 'medha-image-modal-footer';
    footer.appendChild(downloadBtn);
    
    const content = document.createElement('div');
    content.className = 'medha-image-modal-content';
    content.appendChild(header);
    content.appendChild(body);
    content.appendChild(footer);
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  function renderNotes() {
    const container = document.getElementById('medha-notes-list'); 
    if (!container) return;
    if ((state.notes || []).length === 0) {
      container.innerHTML = '<div class="medha-empty-state"><div class="medha-empty-icon">📝</div><div class="medha-empty-text">No notes yet. Start taking notes!</div></div>';
      return;
    }
    container.innerHTML = state.notes.map(note => {
      const contentText = note.note_content ? `<div class="medha-note-text">${escapeHtml(note.note_content)}</div>` : '';
      let noteImage = '';
      if (note.media && note.media.length > 0) {
        noteImage = `<div class="medha-note-images" style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">`;
        note.media.forEach(imgUrl => {
          noteImage += `<img src="${escapeHtml(imgUrl)}" alt="Note image" style="max-height: 120px; border-radius: 6px; cursor: pointer; object-fit: contain;" data-image-src="${escapeHtml(imgUrl)}" class="medha-note-image-clickable" />`;
        });
        noteImage += `</div>`;
      }
      const editBtn = (note.note_content || (note.media && note.media.length > 0)) ? `<button class="medha-note-edit-btn" data-note-id="${note.id}" title="Edit" ${note.isSaving ? 'disabled style="opacity: 0.5"' : ''}><span class="icon">✏️</span></button>` : '';
      const delBtn = `<button class="medha-note-delete-btn" data-note-id="${note.id}" title="Delete" ${note.isSaving ? 'disabled style="opacity: 0.5"' : ''}><span class="icon">🗑️</span></button>`;
      
      return `
        <div class="medha-note-item" data-note-id="${note.id}" style="${note.isSaving ? 'opacity: 0.7; pointer-events: none;' : ''}">
          <div class="medha-note-header">
            <span class="medha-note-time" data-timestamp="${note.timestamp}">${note.timestamp}</span>
            <div class="medha-note-actions">
              ${note.isSaving ? '<span class="medha-spinner" style="width: 14px; height: 14px; border-width: 2px; margin-right: 4px;"></span>' : ''}
              ${editBtn}
              ${delBtn}
            </div>
          </div>
          ${contentText}
          ${noteImage}
        </div>
      `;
    }).join('');
    
    container.querySelectorAll('.medha-note-time').forEach(timeEl => {
      timeEl.addEventListener('click', () => { 
        const seconds = timestampToSeconds(timeEl.dataset.timestamp); 
        const video = document.querySelector('video'); 
        if (video) video.currentTime = seconds; 
      });
    });
    container.querySelectorAll('.medha-note-edit-btn').forEach(btn => { 
      btn.addEventListener('click', () => editNoteHandler(btn.dataset.noteId)); 
    });
    container.querySelectorAll('.medha-note-delete-btn').forEach(btn => { 
      btn.addEventListener('click', () => deleteNoteHandler(btn.dataset.noteId)); 
    });
    container.querySelectorAll('.medha-note-image-clickable').forEach(img => {
      img.addEventListener('click', () => {
        const imageSrc = img.getAttribute('data-image-src');
        if (imageSrc) showImageModal(imageSrc);
      });
    });
    
    // Attach infinite scroll listener
    setupNotesScroll();
  }

  let notesSkip = 0;
  const notesLimit = 10;
  let notesHasMore = true;
  let isNotesLoading = false;

  async function loadNotes(reset = true) {
    if (!state.currentTutorialId) return;
    if (isNotesLoading) return;
    
    const container = document.getElementById('medha-notes-list');
    
    if (reset) {
      notesSkip = 0;
      notesHasMore = true;
      state.notes = [];
      if (container) {
        container.innerHTML = `
          <div class="medha-skeleton-loader" style="padding: 0;">
            <div class="medha-skeleton-card" style="height: 80px;"></div>
            <div class="medha-skeleton-card" style="height: 120px;"></div>
            <div class="medha-skeleton-card" style="height: 60px;"></div>
          </div>
        `;
      }
    }
    
    if (!notesHasMore) return;
    
    isNotesLoading = true;
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'getNotes', 
        data: { tutorialId: state.currentTutorialId, skip: notesSkip, limit: notesLimit } 
      });
      
      const fetchedNotes = response && response.data ? response.data : [];
      if (fetchedNotes.length < notesLimit) {
        notesHasMore = false;
      }
      
      notesSkip += notesLimit;
      
      if (reset) {
        state.notes = fetchedNotes;
      } else {
        state.notes = [...state.notes, ...fetchedNotes];
      }
      
      renderNotes();
    } catch (error) { 
      if (reset) {
        state.notes = []; 
        renderNotes(); 
      }
    } finally {
      isNotesLoading = false;
    }
  }

  function setupNotesScroll() {
    const body = document.querySelector('.medha-body');
    const notesTab = document.getElementById('tab-notes');
    if (body && !body.dataset.notesScrollAttached) {
      body.dataset.notesScrollAttached = "true";
      body.addEventListener('scroll', () => {
        // Only load more if notes tab is active
        if (!notesTab || !notesTab.classList.contains('active')) return;
        
        // Load more when scrolled near the bottom (100px threshold)
        if (body.scrollHeight - body.scrollTop <= body.clientHeight + 100) {
          if (notesHasMore && !isNotesLoading) {
            loadNotes(false);
          }
        }
      });
    }
  }

  // Call setupNotesScroll after rendering the first time or when the DOM is ready.
  // We can attach it in renderNotes safely if we make sure to only attach it once.

  function editNoteHandler(noteId) {
    const note = (state.notes || []).find(n => n.id === noteId); 
    if (!note) { showNotification && showNotification('❌ Note not found', 'error'); return; }

    const existing = document.getElementById('medha-edit-note-modal');
    if (existing) existing.remove();

    let mediaToKeep = [...(note.media || [])];
    let newImagesBase64 = [];

    const modal = document.createElement('div');
    modal.id = 'medha-edit-note-modal';
    modal.className = 'medha-edit-note-modal';
    
    modal.innerHTML = `
      <div class="medha-edit-note-content">
        <div class="medha-edit-note-header">
          <h2>Edit Note</h2>
          <button id="medha-edit-note-close" class="medha-modal-close" title="Close">×</button>
        </div>
        <div class="medha-edit-note-body">
          <textarea id="medha-edit-note-text" class="medha-edit-note-textarea" placeholder="Note content...">${escapeHtml(note.note_content || '')}</textarea>
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
            <label style="font-size: 14px; font-weight: 600; color: var(--medha-text-secondary);">Images</label>
            <button id="medha-edit-note-add-img-btn" class="medha-btn-modern" style="padding: 6px 12px; font-size: 12px;"><span class="icon">🖼️</span> Add Image</button>
            <input type="file" id="medha-edit-note-file-input" accept="image/*" style="display: none;" />
          </div>
          
          <div id="medha-edit-note-gallery" class="medha-edit-note-gallery">
            <!-- Images will be rendered here -->
          </div>
        </div>
        <div class="medha-edit-note-footer">
          <button id="medha-edit-note-cancel" class="medha-btn-modern">Cancel</button>
          <button id="medha-edit-note-save" class="medha-btn-modern medha-btn-primary">Save Changes</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = document.getElementById('medha-edit-note-close');
    const cancelBtn = document.getElementById('medha-edit-note-cancel');
    const saveBtn = document.getElementById('medha-edit-note-save');
    const addImgBtn = document.getElementById('medha-edit-note-add-img-btn');
    const fileInput = document.getElementById('medha-edit-note-file-input');
    const galleryContainer = document.getElementById('medha-edit-note-gallery');
    const textarea = document.getElementById('medha-edit-note-text');

    const closeModal = () => modal.remove();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    const renderGallery = () => {
      let html = '';
      
      // Render existing images to keep
      mediaToKeep.forEach((url, index) => {
        html += `
          <div class="medha-edit-note-gallery-item">
            <img src="${escapeHtml(url)}" alt="Existing image" />
            <button type="button" class="medha-edit-note-remove-img medha-remove-kept-img" data-index="${index}" title="Remove image">×</button>
          </div>
        `;
      });
      
      // Render new base64 images
      newImagesBase64.forEach((b64, index) => {
        html += `
          <div class="medha-edit-note-gallery-item">
            <img src="${b64}" alt="New image" />
            <button type="button" class="medha-edit-note-remove-img medha-remove-new-img" data-index="${index}" title="Remove new image">×</button>
          </div>
        `;
      });

      galleryContainer.innerHTML = html;

      // Attach remove events
      galleryContainer.querySelectorAll('.medha-remove-kept-img').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.index);
          mediaToKeep.splice(idx, 1);
          renderGallery();
        });
      });

      galleryContainer.querySelectorAll('.medha-remove-new-img').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.index);
          newImagesBase64.splice(idx, 1);
          renderGallery();
        });
      });
    };

    renderGallery();

    addImgBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showNotification && showNotification('⚠️ Please upload an image file', 'warning');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showNotification && showNotification('⚠️ Please upload an image smaller than 10MB', 'warning');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        newImagesBase64.push(reader.result);
        renderGallery();
      };
      reader.onerror = () => {
        showNotification && showNotification('❌ Failed to read image file', 'error');
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });

    saveBtn.addEventListener('click', async () => {
      const updatedText = textarea.value.trim();
      if (!updatedText && mediaToKeep.length === 0 && newImagesBase64.length === 0) {
        showNotification && showNotification('⚠️ Note cannot be completely empty', 'warning');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="medha-spinner"></span> Saving...';

      try {
        await chrome.runtime.sendMessage({ 
          action: 'updateNote', 
          data: { 
            noteId, 
            updatedText,
            mediaToKeep,
            newImages: newImagesBase64
          } 
        });
        showNotification && showNotification('✅ Note updated successfully!', 'success');
        closeModal();
        await loadNotes(true);
      } catch (error) {
        showNotification && showNotification('❌ Failed to update note: ' + error.message, 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Save Changes';
      }
    });
  }

  async function deleteNoteHandler(noteId) {
    const note = (state.notes || []).find(n => n.id === noteId); if (!note) { showNotification && showNotification('❌ Note not found', 'error'); return; }
    const notePreview = note.note_content ? (note.note_content.substring(0, 50) + '...') : ((note.media && note.media.length > 0) ? '[Image note]' : '[Empty note]');
    if (!confirm('Are you sure you want to delete this note?\n\n"' + notePreview + '"')) return;
    try { await chrome.runtime.sendMessage({ action: 'deleteNote', data: { noteId } }); showNotification && showNotification(' Note deleted successfully!', 'success'); await loadNotes(true); }
    catch (error) { showNotification && showNotification('❌ Failed to delete note: ' + error.message, 'error'); }
  }

  async function toggleVoiceRecording(btnId = 'medha-voice-btn', inputId = 'medha-note-input') {
    const btn = document.getElementById(btnId);
    if (state.isRecording) { stopVoiceRecording(btnId); }
    else { await startVoiceRecording(btn, inputId, btnId); }
  }

  async function startVoiceRecording(btn, inputId, btnId) {
    try {
      pauseVideo();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.mediaRecorder = new MediaRecorder(stream); state.audioChunks = [];
      state.mediaRecorder.ondataavailable = (event) => { state.audioChunks.push(event.data); };
      state.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
        await transcribeAudio(audioBlob, inputId); stream.getTracks().forEach(track => track.stop());
        setTimeout(() => { if (!state.isUserTyping) resumeVideo(); }, 1000);
      };
      state.mediaRecorder.start(); state.isRecording = true;
      btn.classList.add('recording'); btn.innerHTML = '<span class="icon pulse">🔴</span>'; btn.title = 'Stop Recording';
      showNotification && showNotification('🎤 Recording...', 'info');
    } catch (error) {
      showNotification && showNotification('❌ Failed to access microphone', 'error'); resumeVideo();
    }
  }

  function stopVoiceRecording(btnId = 'medha-voice-btn') {
    if (state.mediaRecorder && state.isRecording) {
      state.mediaRecorder.stop(); state.isRecording = false;
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.classList.remove('recording'); btn.innerHTML = '<span class="icon">🎤</span>'; btn.title = 'Voice Input';
      }
    }
  }

  async function transcribeAudio(audioBlob, targetInputId = 'medha-note-input') {
    state.isTranscribing = true; showNotification && showNotification('⏳ Transcribing...', 'info');
    try {
      const response = await chrome.runtime.sendMessage({ action: 'transcribeAudio', data: { audioBlob: Array.from(new Uint8Array(await audioBlob.arrayBuffer())) } });
      if (!response || response.error) throw new Error(response?.error || 'Transcription failed');
      const input = document.getElementById(targetInputId);
      if (input) input.value = response.text;
      showNotification && showNotification(' Transcription complete!', 'success');
    } catch (error) { showNotification && showNotification('❌ Transcription failed. Please try again.', 'error'); }
    finally { state.isTranscribing = false; }
  }

  async function rewriteNote() {
    const input = document.getElementById('medha-note-input');
    const text = input.value.trim(); if (!text) { showNotification && showNotification('⚠️ Please enter some text first', 'warning'); return; }
    const btn = document.getElementById('medha-rewrite-btn'); btn.disabled = true; btn.innerHTML = '<span class="medha-spinner"></span>';
    try {
      const response = await chrome.runtime.sendMessage({ action: 'rewriteText', data: { text, context: 'note' } });
      if (response.improvement_applied) { input.value = response.rewritten_text; showNotification && showNotification('✨ Text enhanced!', 'success'); }
      else { showNotification && showNotification('👍 Text looks good already!', 'info'); }
    } catch (error) { showNotification && showNotification('❌ Failed to enhance text', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<span class="icon">✨</span>'; }
  }

  // Notes Preview & PDF
  function renderMarkdown(markdown) {
    if (!markdown) return '';
    let lines = markdown.split('\n'); let html = []; let listStack = [];
    function closeAllLists() { while (listStack.length > 0) { html.push('</ul>'); listStack.pop(); } }
    function formatInline(text) { text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); text = text.replace(/\*(.+?)\*/g, '<em>$1</em>'); text = text.replace(/`(.+?)`/g, '<code>$1</code>'); return text; }
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]; let trimmed = line.trim();
      if (trimmed.startsWith('### ')) { closeAllLists(); html.push(`<h3>${escapeHtml(trimmed.substring(4))}</h3>`); continue; }
      else if (trimmed.startsWith('## ')) { closeAllLists(); html.push(`<h2>${escapeHtml(trimmed.substring(3))}</h2>`); continue; }
      else if (trimmed.startsWith('# ')) { closeAllLists(); html.push(`<h1>${escapeHtml(trimmed.substring(2))}</h1>`); continue; }
      let listMatch = line.match(/^(\s*)([\*\-])\s+(.+)/); if (listMatch) {
        let indent = listMatch[1].length; let content = listMatch[3]; let level = Math.floor(indent / 2);
        while (listStack.length > level + 1) { html.push('</ul>'); listStack.pop(); }
        if (listStack.length <= level) { html.push('<ul>'); listStack.push(level); }
        content = formatInline(escapeHtml(content)); html.push(`<li>${content}</li>`); continue;
      }
      if (trimmed && !listMatch) closeAllLists();
      if (!trimmed) continue;
      if (!listMatch && trimmed) { let content = formatInline(escapeHtml(trimmed)); html.push(`<p>${content}</p>`); }
    }
    closeAllLists(); return html.join('\n');
  }

  function downloadNotesAsPDF(content, title) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document; if (!doc) return;
    const htmlContent = convertMarkdownToHTMLForPDF(content);
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>${title}</title><style>@page{margin:2cm;size:A4;}body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.8;color:#1f2937;max-width:100%;margin:0 auto;padding:20px;word-wrap:break-word;overflow-wrap:break-word;}h1{color:#6366f1;font-size:28px;border-bottom:3px solid #6366f1;padding-bottom:10px;margin-top:0;margin-bottom:0.8em;word-wrap:break-word;}h2{color:#6366f1;font-size:22px;margin-top:1.2em;margin-bottom:0.5em;word-wrap:break-word;}h3{color:#4f46e5;font-size:18px;margin-top:1em;margin-bottom:0.4em;word-wrap:break-word;}p{margin:0.5em 0;font-size:15px;word-wrap:break-word;white-space:pre-wrap;}ul{margin:0.5em 0;padding-left:30px;list-style-type:disc;}ul ul{margin:0.3em 0;padding-left:25px;list-style-type:circle;}ul ul ul{list-style-type:square;}li{margin:0.4em 0;font-size:15px;word-wrap:break-word;line-height:1.6;}code{background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:'Courier New',monospace;font-size:14px;word-break:break-all;}strong{color:#374151;font-weight:600;}em{font-style:italic;color:#6b7280;}</style></head><body><h1>${ns.escapeHtml(title)}</h1>${htmlContent}</body></html>`);
    doc.close();
    setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => { document.body.removeChild(iframe); }, 100); }, 250);
  }

  function convertMarkdownToHTMLForPDF(markdown) {
    if (!markdown) return '';
    let lines = markdown.split('\n'); let html = []; let listStack = [];
    function closeAllLists() { while (listStack.length > 0) { html.push('</ul>'); listStack.pop(); } }
    function formatInline(text) { text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); text = text.replace(/\*(.+?)\*/g, '<em>$1</em>'); text = text.replace(/`(.+?)`/g, '<code>$1</code>'); return text; }
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]; let trimmed = line.trim();
      if (trimmed.startsWith('### ')) { closeAllLists(); html.push(`<h3>${escapeHtml(trimmed.substring(4))}</h3>`); continue; }
      else if (trimmed.startsWith('## ')) { closeAllLists(); html.push(`<h2>${escapeHtml(trimmed.substring(3))}</h2>`); continue; }
      else if (trimmed.startsWith('# ')) { closeAllLists(); html.push(`<h2>${escapeHtml(trimmed.substring(2))}</h2>`); continue; }
      let listMatch = line.match(/^(\s*)([\*\-])\s+(.+)/);
      if (listMatch) {
        let indent = listMatch[1].length; let content = listMatch[3]; let level = Math.floor(indent / 2);
        while (listStack.length > level + 1) { html.push('</ul>'); listStack.pop(); }
        if (listStack.length <= level) { html.push('<ul>'); listStack.push(level); }
        content = formatInline(escapeHtml(content)); html.push(`<li>${content}</li>`); continue;
      }
      if (trimmed && !listMatch) closeAllLists(); if (!trimmed) continue;
      if (!listMatch && trimmed) { let content = formatInline(escapeHtml(trimmed)); html.push(`<p>${content}</p>`); }
    }
    closeAllLists(); return html.join('\n');
  }

  function showNotesPreview(content, title) {
    const existing = document.getElementById('medha-notes-preview'); if (existing) existing.remove();
    let isEditing = false; let editableContent = content;
    const modal = document.createElement('div'); modal.id = 'medha-notes-preview'; modal.className = 'medha-notes-modal';
    modal.innerHTML = `
      <div class="medha-notes-modal-content">
        <div class="medha-notes-modal-header">
          <div><h2>${title}</h2><p>Review, edit and download your notes</p></div>
          <div class="medha-header-actions">
            <button id="medha-edit-toggle" class="medha-header-btn" title="Edit"><span class="icon">✏️</span></button>
            <button id="medha-minimize-preview" class="medha-header-btn" title="Minimize"><span class="icon">−</span></button>
          </div>
        </div>
        <div class="medha-notes-modal-body">
          <div class="medha-notes-content" id="medha-notes-rendered">${renderMarkdown(content)}</div>
          <textarea id="medha-notes-editor" class="medha-notes-edit-textarea" style="display:none;">${escapeHtml(content)}</textarea>
        </div>
        <div class="medha-notes-modal-footer">
          <button id="medha-download-notes" class="medha-btn-modern medha-btn-primary"><span class="icon">⬇</span> Download as PDF</button>
          <button id="medha-minimize-preview-btn" class="medha-btn-modern">Minimize</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const renderedDiv = document.getElementById('medha-notes-rendered'); const editorTextarea = document.getElementById('medha-notes-editor'); const editToggleBtn = document.getElementById('medha-edit-toggle');
    const minimizePreview = () => { modal.remove(); window.Medha.ui && window.Medha.ui.createFloatingIcon && window.Medha.ui.createFloatingIcon(); showNotification && showNotification('Preview minimized', 'info'); };
    editToggleBtn.addEventListener('click', () => { isEditing = !isEditing; if (isEditing) { renderedDiv.style.display = 'none'; editorTextarea.style.display = 'block'; editToggleBtn.innerHTML = '<span class="icon">👁️</span>'; editToggleBtn.title = 'Preview'; } else { editableContent = editorTextarea.value; renderedDiv.innerHTML = renderMarkdown(editableContent); renderedDiv.style.display = 'block'; editorTextarea.style.display = 'none'; editToggleBtn.innerHTML = '<span class="icon">✏️</span>'; editToggleBtn.title = 'Edit'; } });
    document.getElementById('medha-minimize-preview').addEventListener('click', minimizePreview);
    document.getElementById('medha-minimize-preview-btn').addEventListener('click', minimizePreview);
    document.getElementById('medha-download-notes').addEventListener('click', () => { const contentToDownload = isEditing ? editorTextarea.value : editableContent; downloadNotesAsPDF(contentToDownload, title); showNotification && showNotification(' Notes downloaded as PDF!', 'success'); });
    modal.addEventListener('click', (e) => { if (e.target === modal) minimizePreview(); });
  }

  async function prettifyNotes() {
    if (!state.currentTutorialId) return;
    const btn = document.getElementById('medha-prettify-notes'); btn.disabled = true; btn.innerHTML = '<span class="medha-spinner"></span> Organizing...';
    try { const response = await chrome.runtime.sendMessage({ action: 'prettifyNotes', data: { tutorialId: state.currentTutorialId } }); showNotification && showNotification(' Notes organized successfully!', 'success'); showNotesPreview(response.prettified_notes, 'Organized Notes'); }
    catch (error) { showNotification && showNotification('❌ Failed: ' + error.message, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<span class="icon">✨</span> Organize'; }
  }

  async function generateDetailedNotes() {
    if (!state.currentTutorialId) return;
    const btn = document.getElementById('medha-detailed-notes'); btn.disabled = true; btn.innerHTML = '<span class="medha-spinner"></span> Generating...';
    try { const response = await chrome.runtime.sendMessage({ action: 'generateDetailedNotes', data: { tutorialId: state.currentTutorialId } }); showNotification && showNotification(' Detailed notes generated!', 'success'); showNotesPreview(response.detailed_notes, 'Detailed Study Notes'); }
    catch (error) { showNotification && showNotification('❌ Failed: ' + error.message, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<span class="icon">📚</span> Expand'; }
  }

  ns.features.addNote = addNote;
  ns.features.toggleVoiceRecording = toggleVoiceRecording;
  ns.features.rewriteNote = rewriteNote;
  ns.features.loadNotes = loadNotes;
  ns.features.prettifyNotes = prettifyNotes;
  ns.features.generateDetailedNotes = generateDetailedNotes;
  ns.features.processImageFile = processImageFile;
  ns.features.processScreenshot = processScreenshot;
  ns.features.removeImage = removeImage;
  ns.features.showImageModal = showImageModal;
})();


