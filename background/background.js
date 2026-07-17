// Background Service Worker
// Handles API communication and message passing

// Import API service
importScripts('../lib/api.js');

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // Handle async messages
  handleMessage(request, sender)
    .then(response => {
      sendResponse(response);
    })
    .catch(error => {
      sendResponse({ error: error.message });
    });
  
  // Keep channel open for async response
  return true;
});

// Main message handler
async function handleMessage(request, sender) {
  const { action, data } = request;

  try {
    switch (action) {
      case 'takeScreenshot':
        return new Promise((resolve, reject) => {
          chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve({ dataUrl });
            }
          });
        });

      case 'downloadImage':
        return new Promise((resolve, reject) => {
          chrome.downloads.download({
            url: data.url,
            filename: data.filename,
            saveAs: false
          }, (downloadId) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve({ success: true, downloadId });
            }
          });
        });

      // ========================================================================
      // TUTORIAL SUPPORT
      // ========================================================================
      
      case 'createTutorial':
        return await api.createTutorial({
          url: data.tutorialLink,
          title: data.title || "YouTube Video",
          group_id: data.group
        });
      
      case 'updateTutorial':
        return await api.updateTutorial(data.tutorialId, {
          title: data.title,
          group_id: data.group,
          subgroup_id: data.subgroup
        });
      
      case 'addNote':
        return await api.addNote(data.tutorialId, data.note, data.timestamp, data.images);
      
      case 'getNotes':
        return await api.getNotes(data.tutorialId, data.skip || 0, data.limit || 10);
      
      case 'updateNote':
        return await api.updateNote(data.noteId, data.updatedText, data.mediaToKeep, data.newImages);
      
      case 'deleteNote':
        return await api.deleteNote(data.noteId);
      
      case 'chatWithAI':
        return await api.chatWithAI(
          data.tutorialId,
          data.question,
          data.currentTimestamp
        );
      
      case 'getChatHistory':
        return await api.getChatHistory(data.tutorialId, data.skip || 0, data.limit || 50);
      

      case 'getMyTutorials':
        return await api.getMyTutorials();
      
      case 'getGroups':
        return await api.getGroups();
        
      case 'createGroup':
        return await api.createGroup(data.groupName);
        
      case 'assignTutorial':
        return await api.assignTutorial(data.tutorialId, data.groupId, data.subgroupId);
      
      case 'findTutorialByLink':
        return await api.findTutorialByLink(data.tutorialLink);
      
      case 'prettifyNotes':
        return await api.prettifyNotes(data.tutorialId);
      
      case 'generateDetailedNotes':
        return await api.generateDetailedNotes(data.tutorialId);
      
      case 'transcribeAudio':
        return await transcribeAudioHandler(data);
      
      case 'rewriteText':
        return await api.request('/utils/rewrite-text', {
          method: 'POST',
          body: JSON.stringify(data)
        });
      
      // ========================================================================
      // UNKNOWN ACTION
      // ========================================================================
      
      case 'openPopup':
        if (data && data.showFab && sender?.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, { action: 'showFab' });
          return { success: true };
        }

        // Open extension popup by opening extension's popup.html in new tab
        chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html') });
        return { success: true };
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    throw error;
  }
}

// Listen for extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  // Don't auto-open popup on install - user will click extension icon when ready
  if (details.reason === 'install') {
    // Extension installed - user can click icon to open popup
  } else if (details.reason === 'update') {
    // Extension updated
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { action: 'showFab' });
});

// Audio transcription handler with fallback
async function transcribeAudioHandler(data) {
  const { audioBlob } = data;
  
  // Convert array back to Blob
  const blob = new Blob([new Uint8Array(audioBlob)], { type: 'audio/webm' });
  const formData = new FormData();
  
  const { authToken } = await api.getTokens();
  
  // Try primary endpoint
  try {
    formData.append('audio_file', blob, 'recording.webm');
    
    const response = await fetch(`${api.baseURL}/utils/speech-to-text`, {
      method: 'POST',
      headers: {
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      },
      body: formData
    });
    
    if (!response.ok) throw new Error('Primary STT failed');
    return await response.json();
  } catch (primaryError) {
    throw new Error('STT endpoint failed');
  }
}

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
});

