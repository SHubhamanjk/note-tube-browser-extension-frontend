(function setupMedhaNamespace() {
  'use strict';

  window.Medha = window.Medha || {};

  const state = {
    currentTutorialId: null,
    currentTutorialGroup: 'general',
    isMinimized: false,
    notes: [],
    chatMessages: [],
    isInitializing: false,
    isRecording: false,
    isTranscribing: false,
    mediaRecorder: null,
    audioChunks: [],
    wasPlayingBeforePause: false,
    typingTimer: null,
    isUserTyping: false,
    lastVideoUrl: null
  };

  window.Medha.state = state;
})();


