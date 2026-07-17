(function setupYouTubeServices() {
  'use strict';

  const ns = window.Medha || (window.Medha = {});
  const state = ns.state;

  function getYouTubeVideoId() {
    const url = window.location.href;
    const watchMatch = url.match(/[?&]v=([^&]+)/);
    if (watchMatch) return watchMatch[1];
    const liveMatch = url.match(/\/live\/([^?&]+)/);
    if (liveMatch) return liveMatch[1];
    return null;
  }

  function getNormalizedYouTubeUrl() {
    const id = getYouTubeVideoId();
    if (!id) return null;
    return `https://www.youtube.com/watch?v=${id}`;
  }

  function extractVideoId(url) {
    const match = url && url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }

  function getVideoPlayer() {
    return document.querySelector('video');
  }

  function getCurrentTime() {
    const player = getVideoPlayer();
    if (player) {
      const seconds = Math.floor(player.currentTime);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return '0:00';
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function pauseVideo() {
    const player = getVideoPlayer();
    if (player && !player.paused) {
      state.wasPlayingBeforePause = true;
      player.pause();
    }
  }

  function resumeVideo() {
    const player = getVideoPlayer();
    if (player && player.paused && state.wasPlayingBeforePause) {
      player.play();
      state.wasPlayingBeforePause = false;
    }
  }

  function timestampToSeconds(timestamp) {
    const parts = String(timestamp).split(':').map(p => parseInt(p));
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }

  ns.youtube = {
    getYouTubeVideoId,
    getNormalizedYouTubeUrl,
    extractVideoId,
    getVideoPlayer,
    getCurrentTime,
    formatTime,
    pauseVideo,
    resumeVideo,
    timestampToSeconds
  };
})();


