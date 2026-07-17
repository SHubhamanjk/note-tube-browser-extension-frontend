(function initMedhaExtension() {
  'use strict';

  const ns = window.Medha || (window.Medha = {});
  const { state } = ns;
  const { showNotification } = ns;
  const yt = ns.youtube;

  function checkPageAndStart() {
    const videoId = yt.getYouTubeVideoId();
    setupURLChangeDetection();
    setupYouTubeNavigationEvents();
    setupWatchFlexyObserver();

    if (!videoId) {
      // Video ID not in URL yet, wait for navigation and video element creation
      waitForVideoPlayer();
      return;
    }

    state.lastVideoUrl = yt.getNormalizedYouTubeUrl() || window.location.href;

    // Show FAB optimistically while we wait for the player (behaves like previous implementation)
    checkExistingSession();
    waitForVideoPlayerAndStart();
  }

  function waitForVideoPlayerAndStart() {
    // Check if video player already exists
    const videoPlayer = yt.getVideoPlayer();
    if (videoPlayer) {
      // Video player is ready, proceed immediately
      checkExistingSession();
      return;
    }

    // Video player not ready yet, wait for it
    let checkAttempts = 0;
    const maxAttempts = 50; // Check for up to 5 seconds (50 * 100ms)
    let checkInterval = null;
    
    // Cleanup function
    const clearObserver = () => {
      if (window._medhaVideoObserver) {
        window._medhaVideoObserver.disconnect();
        window._medhaVideoObserver = null;
      }
    };

    // Function to cleanup and start session
    const cleanupAndStart = () => {
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
      if (window._medhaVideoObserver) {
        window._medhaVideoObserver.disconnect();
        window._medhaVideoObserver = null;
      }
      checkExistingSession();
    };

    // Also use MutationObserver as a more efficient fallback
    const observer = new MutationObserver((mutations) => {
      const videoPlayer = yt.getVideoPlayer();
      if (videoPlayer) {
        cleanupAndStart();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Store observer reference for cleanup
    window._medhaVideoObserver = observer;
    
    checkInterval = setInterval(() => {
      checkAttempts++;
      const videoPlayer = yt.getVideoPlayer();
      
      if (videoPlayer) {
        cleanupAndStart();
      } else if (checkAttempts >= maxAttempts) {
        cleanupAndStart();
      }
    }, 100);

    // Cleanup on page unload
    window.addEventListener('beforeunload', clearObserver);
  }

  function waitForVideoPlayer() {
    // This is for when we're not on a watch page yet
    // Wait for navigation to a video page
    let lastDetectedVideoId = null;
    const observer = new MutationObserver(() => {
      const videoId = yt.getYouTubeVideoId();
      if (videoId && videoId !== lastDetectedVideoId) {
        lastDetectedVideoId = videoId;
        state.lastVideoUrl = yt.getNormalizedYouTubeUrl() || window.location.href;

        // Kick off initialization immediately and then disconnect observer to avoid duplicate triggers
        checkExistingSession();
        waitForVideoPlayerAndStart();

        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function setupURLChangeDetection() {
    let lastUrl = window.location.href;
    const originalPushState = history.pushState; const originalReplaceState = history.replaceState;
    history.pushState = function() { originalPushState.apply(this, arguments); handleUrlChange(); };
    history.replaceState = function() { originalReplaceState.apply(this, arguments); handleUrlChange(); };
    window.addEventListener('popstate', handleUrlChange);
    setInterval(() => { if (window.location.href !== lastUrl) { lastUrl = window.location.href; handleUrlChange(); } }, 1000);
    function handleUrlChange() {
      const currentUrl = window.location.href;
      if (currentUrl.includes('/watch?v=')) {
        const currentVideoId = yt.getYouTubeVideoId();
        const lastVideoId = yt.extractVideoId(state.lastVideoUrl);
        if (currentVideoId && currentVideoId !== lastVideoId) {
          state.lastVideoUrl = yt.getNormalizedYouTubeUrl() || currentUrl;
          reinitializeForNewVideo();
        }
      } else {
        const widget = document.getElementById('medha-widget'); const fab = document.getElementById('medha-fab');
        if (widget || fab) { cleanupSession(); }
      }
    }
  }

  function cleanupSession() {
    const widget = document.getElementById('medha-widget'); const fab = document.getElementById('medha-fab');
    if (widget) widget.remove(); if (fab) fab.remove();
    state.currentTutorialId = null; state.currentTutorialGroup = 'general'; state.isMinimized = false; state.notes = []; state.chatMessages = [];
    state.isInitializing = false; state.isRecording = false; state.isTranscribing = false; state.mediaRecorder = null; state.audioChunks = [];
    state.wasPlayingBeforePause = false; state.typingTimer = null; state.isUserTyping = false;

    if (window._medhaVideoObserver) {
      window._medhaVideoObserver.disconnect();
      window._medhaVideoObserver = null;
    }
  }

  async function reinitializeForNewVideo() {
    cleanupSession();
    // Show FAB optimistically while we wait for the player to appear
    checkExistingSession();
    waitForVideoPlayerAndStart();
  }

  function setupYouTubeNavigationEvents() {
    if (window._medhaYouTubeNavEventsAttached) return;

    const handleNavigation = () => {
      // Use a short delay to allow YouTube's internal state to update
      setTimeout(() => {
        handleYouTubeNavigation();
      }, 50);
    };

    ['yt-navigate-start', 'yt-navigate-finish', 'yt-page-data-updated'].forEach((eventName) => {
      document.addEventListener(eventName, handleNavigation, true);
    });

    window._medhaYouTubeNavEventsAttached = true;
  }

  function handleYouTubeNavigation() {
    const currentUrl = window.location.href;
    const videoId = yt.getYouTubeVideoId();

    if (!currentUrl.includes('/watch') || !videoId) {
      // Not on a video page anymore – clean up any UI
      cleanupSession();
      state.lastVideoUrl = null;
      return;
    }

    const normalized = yt.getNormalizedYouTubeUrl();
    if (!normalized) return;

    if (normalized !== state.lastVideoUrl) {
      state.lastVideoUrl = normalized;
      reinitializeForNewVideo();
    }
  }

  function setupWatchFlexyObserver() {
    if (window._medhaWatchObserver && window._medhaWatchElement && document.contains(window._medhaWatchElement)) {
      return;
    }

    const attachObserverToWatchElement = () => {
      const watchElement = document.querySelector('ytd-watch-flexy');
      if (!watchElement) return false;

      window._medhaWatchElement = watchElement;

      const handleVideoAttributeChange = () => {
        const videoIdAttr = watchElement.getAttribute('video-id');
        const videoId = videoIdAttr || yt.getYouTubeVideoId();
        if (!videoId) return;

        const normalized = `https://www.youtube.com/watch?v=${videoId}`;
        if (normalized !== state.lastVideoUrl) {
          state.lastVideoUrl = normalized;
          reinitializeForNewVideo();
        }
      };

      // Run once immediately when attaching
      handleVideoAttributeChange();

      const watchObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'video-id') {
            handleVideoAttributeChange();
            break;
          }
        }
      });

      watchObserver.observe(watchElement, {
        attributes: true,
        attributeFilter: ['video-id']
      });

      window._medhaWatchObserver = watchObserver;
      window._medhaWatchElement = watchElement;

      if (!window._medhaWatchPresenceObserver) {
        const presenceObserver = new MutationObserver(() => {
          if (!window._medhaWatchElement || document.contains(window._medhaWatchElement)) {
            return;
          }

          if (window._medhaWatchObserver) {
            window._medhaWatchObserver.disconnect();
            window._medhaWatchObserver = null;
          }

          window._medhaWatchElement = null;
          setupWatchFlexyObserver();
        });

        presenceObserver.observe(document.body, {
          childList: true,
          subtree: true
        });

        window._medhaWatchPresenceObserver = presenceObserver;
      }

      return true;
    };

    if (!attachObserverToWatchElement()) {
      const finderObserver = new MutationObserver(() => {
        if (attachObserverToWatchElement()) {
          finderObserver.disconnect();
          window._medhaWatchFinder = null;
        }
      });

      finderObserver.observe(document.body, {
        childList: true,
        subtree: true
      });

      window._medhaWatchFinder = finderObserver;
    }
  }

  async function checkExistingSession() {
    if (state.isInitializing || state.currentTutorialId) return;
    const videoUrl = yt.getNormalizedYouTubeUrl(); if (!videoUrl) return;
    
    try {
      const authResult = await chrome.storage.local.get(['authToken']);
      const isAuthenticated = !!authResult.authToken;
      if (isAuthenticated) {
        try {
          const tutorial = await chrome.runtime.sendMessage({ action: 'findTutorialByLink', data: { tutorialLink: videoUrl } });
          if (tutorial && !tutorial.error && (tutorial.tutorial_id || tutorial.id)) {
            window.Medha.ui && window.Medha.ui.createFloatingIcon && window.Medha.ui.createFloatingIcon();
            return true;
          }
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Extension context invalidated. Please refresh the page.', err);
    }
    
    window.Medha.ui && window.Medha.ui.createFloatingIcon && window.Medha.ui.createFloatingIcon();
    return false;
  }

  async function createSessionFromFAB() {
    try {
      const authResult = await chrome.storage.local.get(['authToken']);
      if (!authResult.authToken) { showNotification && showNotification('⚠️ Please login to use Medha.ai features', 'error'); chrome.runtime.sendMessage({ action: 'openPopup' }); return; }
      if (state.isInitializing) return;
      if (state.currentTutorialId) { window.Medha.ui && window.Medha.ui.toggleMinimize && window.Medha.ui.toggleMinimize(); return; }
      state.isInitializing = true;
      const videoUrl = yt.getNormalizedYouTubeUrl(); if (!videoUrl) { state.isInitializing = false; return; }
      
      try {
        const existingTutorial = await chrome.runtime.sendMessage({ action: 'findTutorialByLink', data: { tutorialLink: videoUrl } });
        if (existingTutorial && !existingTutorial.error && (existingTutorial.tutorial_id || existingTutorial.id)) {
          state.currentTutorialId = existingTutorial.tutorial_id || existingTutorial.id; state.currentTutorialGroup = existingTutorial.group_id || existingTutorial.group || 'general';
          const fab = document.getElementById('medha-fab'); if (fab) fab.remove();
          window.Medha.ui && window.Medha.ui.createFloatingWidget && window.Medha.ui.createFloatingWidget(existingTutorial.title);
          await ns.features.loadNotes(); await ns.features.loadChatHistory();
          showNotification && showNotification(' Welcome back! Loaded your tutorial session.', 'success'); state.isInitializing = false; return;
        }
      } catch (error) {}
      
      showNotification && showNotification('Initializing tutorial session...', 'info');
      try {
        const title = document.title ? document.title.replace(/^\(\d+\)\s*/, '').replace(' - YouTube', '') : 'YouTube Video';
        const videoId = yt.getYouTubeVideoId();
        const transcript = videoId ? await yt.fetchTranscript(videoId) : null;
        
        const response = await chrome.runtime.sendMessage({ action: 'createTutorial', data: { tutorialLink: videoUrl, group: 'general', title: title, transcript: transcript } });
        if (response && response.error) {
          throw new Error(response.error);
        }
        state.currentTutorialId = response.tutorial_id || response.id; 
        if (!state.currentTutorialId) throw new Error("No tutorial ID returned");
        state.currentTutorialGroup = response.group_id || 'general';
        const fab = document.getElementById('medha-fab'); if (fab) fab.remove();
        window.Medha.ui && window.Medha.ui.createFloatingWidget && window.Medha.ui.createFloatingWidget(response.title);
        await ns.features.loadNotes(); await ns.features.loadChatHistory();
        showNotification && showNotification(' Tutorial session started!', 'success');
      } catch (error) { showNotification && showNotification('❌ Failed to start session: ' + error.message, 'error'); }
      finally { state.isInitializing = false; }
    } catch (err) {
      console.warn('Extension context invalidated. Please refresh the page.', err);
      showNotification && showNotification('⚠️ Please refresh the page to use Medha.ai', 'error');
      state.isInitializing = false;
    }
  }

  ns.init = { checkExistingSession, createSessionFromFAB };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== 'object') return;

    if (message.action === 'showFab') {
      const normalizedUrl = yt.getNormalizedYouTubeUrl();
      if (normalizedUrl) {
        state.lastVideoUrl = normalizedUrl;
      }

      setupWatchFlexyObserver();

      checkExistingSession()
        .then(() => sendResponse && sendResponse({ success: true }))
        .catch(() => sendResponse && sendResponse({ success: false }));

      return true; // Keep channel open for async response
    }
    
    if (message.action === 'forceLaunch') {
      window.Medha.ui && window.Medha.ui.createFloatingIcon && window.Medha.ui.createFloatingIcon();
      sendResponse({ success: true });
    }

    if (message.action === 'showFuelMission') {
      window.Medha.features && window.Medha.features.showFuelMissionModal && window.Medha.features.showFuelMissionModal();
      sendResponse({ success: true });
    }
  });
  
  // Failsafe: Ensure FAB is visible if on a watch page and neither FAB nor widget exists
  setInterval(() => {
    if (window.location.href.includes('/watch?v=')) {
      if (!document.getElementById('medha-fab') && !document.getElementById('medha-widget')) {
        window.Medha.ui && window.Medha.ui.createFloatingIcon && window.Medha.ui.createFloatingIcon();
      }
    }
  }, 2000);
 
  checkPageAndStart();
})();


