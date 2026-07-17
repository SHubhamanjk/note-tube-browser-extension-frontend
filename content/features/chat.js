(function setupChatFeature() {
  'use strict';

  const ns = window.Medha || (window.Medha = {});
  ns.features = ns.features || {};
  const { state } = ns;
  const { showNotification, escapeHtml } = ns;
  const { getCurrentTime, resumeVideo } = ns.youtube;

  // Enhanced markdown renderer for chat messages
  function renderChatMarkdown(markdown) {
    if (!markdown) return '';
    
    // Split into lines for block-level processing
    let originalLines = markdown.split('\n');
    let lines = markdown.split('\n');
    let html = [];
    let listStack = [];
    let inCodeBlock = false;
    let codeBlockContent = [];
    let codeBlockLang = '';
    
    function closeAllLists() {
      while (listStack.length > 0) {
        html.push('</ul>');
        listStack.pop();
      }
    }
    
    function formatInline(text) {
      // Process markdown patterns: extract content, escape it, then build HTML
      // This approach processes patterns in order and escapes content safely
      
      // Inline code (`code`) - process first
      text = text.replace(/`([^`]+)`/g, (match, code) => {
        return '<code class="medha-code-inline">' + escapeHtml(code) + '</code>';
      });
      
      // Bold (**text** or __text__) - must be before italic to avoid conflicts
      text = text.replace(/\*\*([^*]+)\*\*/g, (match, bold) => {
        return '<strong>' + escapeHtml(bold) + '</strong>';
      });
      text = text.replace(/__([^_]+)__/g, (match, bold) => {
        return '<strong>' + escapeHtml(bold) + '</strong>';
      });
      
      // Italic (*text* or _text_) - after bold
      text = text.replace(/\*([^*]+)\*/g, (match, italic) => {
        return '<em>' + escapeHtml(italic) + '</em>';
      });
      text = text.replace(/_([^_]+)_/g, (match, italic) => {
        return '<em>' + escapeHtml(italic) + '</em>';
      });
      
      // Links [text](url)
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
        return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer" class="medha-link">' + escapeHtml(linkText) + '</a>';
      });
      
      // Now we need to escape any remaining raw HTML that wasn't part of markdown
      // Our markdown processing already created safe HTML tags with escaped content
      // We just need to escape any remaining raw HTML tags that might exist
      // Split text by our markdown-generated tags and escape everything else
      const parts = [];
      let lastIndex = 0;
      // Match our markdown-generated tags: <code>, <strong>, <em>, <a>
      const tagRegex = /<(code|strong|em|a)(\s[^>]*)?>.*?<\/\1>|<\/(code|strong|em|a)>/gi;
      let match;
      
      while ((match = tagRegex.exec(text)) !== null) {
        // Add text before tag (escaped)
        if (match.index > lastIndex) {
          const beforeText = text.substring(lastIndex, match.index);
          if (beforeText) {
            parts.push(escapeHtml(beforeText));
          }
        }
        // Add the markdown-generated tag (already safe)
        parts.push(match[0]);
        lastIndex = match.index + match[0].length;
      }
      
      // Add remaining text after last tag
      if (lastIndex < text.length) {
        const remainingText = text.substring(lastIndex);
        if (remainingText) {
          parts.push(escapeHtml(remainingText));
        }
      }
      
      // If no markdown tags found, escape everything
      if (parts.length === 0) {
        return escapeHtml(text);
      }
      
      return parts.join('');
    }
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      let trimmed = line.trim();
      
      // Handle code blocks (```)
      if (trimmed.startsWith('```')) {
        if (inCodeBlock) {
          // Close code block
          inCodeBlock = false;
          const codeContent = escapeHtml(codeBlockContent.join('\n'));
          html.push(`<pre><code class="medha-code-block">${codeContent}</code></pre>`);
          codeBlockContent = [];
          codeBlockLang = '';
          continue;
        } else {
          // Open code block
          inCodeBlock = true;
          codeBlockLang = (trimmed && trimmed.length > 3) ? trimmed.substring(3).trim() : '';
          codeBlockContent = [];
          continue;
        }
      }
      
      if (inCodeBlock) {
        // Store raw original line for code blocks (will escape when closing)
        codeBlockContent.push(originalLines[i]);
        continue;
      }
      
      // Headers
      if (trimmed && trimmed.startsWith('### ')) {
        closeAllLists();
        html.push(`<h3 class="medha-chat-h3">${formatInline(trimmed.substring(4) || '')}</h3>`);
        continue;
      } else if (trimmed && trimmed.startsWith('## ')) {
        closeAllLists();
        html.push(`<h2 class="medha-chat-h2">${formatInline(trimmed.substring(3) || '')}</h2>`);
        continue;
      } else if (trimmed && trimmed.startsWith('# ')) {
        closeAllLists();
        html.push(`<h1 class="medha-chat-h1">${formatInline(trimmed.substring(2) || '')}</h1>`);
        continue;
      }
      
      // Lists (- or *)
      let listMatch = line.match(/^(\s*)([\*\-]|\d+\.)\s+(.+)/);
      if (listMatch) {
        let indent = listMatch[1].length;
        let marker = listMatch[2];
        let content = listMatch[3];
        let level = Math.floor(indent / 2);
        
        while (listStack.length > level + 1) {
          html.push('</ul>');
          listStack.pop();
        }
        
        if (listStack.length <= level) {
          html.push('<ul class="medha-chat-list">');
          listStack.push(level);
        }
        
        content = formatInline(content);
        html.push(`<li class="medha-chat-list-item">${content}</li>`);
        continue;
      }
      
      // Close lists if we hit a non-list line
      if (trimmed && !listMatch) {
        closeAllLists();
      }
      
      // Empty lines become breaks
      if (!trimmed) {
        html.push('<br>');
        continue;
      }
      
      // Regular paragraphs
      if (!listMatch && trimmed) {
        let content = formatInline(trimmed);
        html.push(`<p class="medha-chat-paragraph">${content}</p>`);
      }
    }
    
    // Close any remaining lists
    closeAllLists();
    
    // Close any open code block
    if (inCodeBlock && codeBlockContent.length > 0) {
      const codeContent = escapeHtml(codeBlockContent.join('\n'));
      html.push(`<pre><code class="medha-code-block">${codeContent}</code></pre>`);
    }
    
    return html.join('');
  }

  function scrollChatToBottom() {
    const chatContainer = document.getElementById('medha-chat-messages');
    const bodyContainer = document.querySelector('.medha-body');
    const chatTab = document.getElementById('tab-chat');
    if (chatContainer) { 
      requestAnimationFrame(() => { 
        chatContainer.scrollTop = chatContainer.scrollHeight; 
        if (bodyContainer && chatTab && chatTab.classList.contains('active')) {
          bodyContainer.scrollTop = bodyContainer.scrollHeight;
        }
      }); 
    }
  }

  function addChatMessage(role, content, prepend = false) {
    const container = document.getElementById('medha-chat-messages');
    const messageId = 'msg-' + Date.now() + Math.floor(Math.random() * 1000);
    const welcome = container.querySelector('.medha-empty-state'); 
    if (welcome) welcome.remove();
    const skeleton = container.querySelector('.medha-skeleton-loader');
    if (skeleton) skeleton.remove();
    
    const wrapper = document.createElement('div'); 
    wrapper.id = messageId; 
    wrapper.className = `medha-chat-message ${role === 'user' ? 'medha-user-message' : 'medha-ai-message'}`;
    
    const label = document.createElement('div'); 
    label.className = 'medha-message-label';
    const icon = document.createElement('span'); 
    icon.className = 'medha-message-icon'; 
    icon.textContent = role === 'user' ? '👤' : '🤖';
    const labelText = document.createElement('span'); 
    labelText.textContent = role === 'user' ? 'You' : 'AI Assistant';
    label.appendChild(icon); 
    label.appendChild(labelText);
    
    const bubble = document.createElement('div'); 
    bubble.className = role === 'user' ? 'medha-message-user' : 'medha-message-ai';
    
    // For AI messages, render markdown; for user messages, use plain text
    if (role === 'assistant' || role === 'ai') {
      bubble.className += ' medha-markdown-content';
      bubble.innerHTML = renderChatMarkdown(content);
    } else {
      bubble.textContent = content;
    }
    
    wrapper.appendChild(label); 
    wrapper.appendChild(bubble); 
    
    if (prepend && container.firstChild) {
      container.insertBefore(wrapper, container.firstChild);
    } else {
      container.appendChild(wrapper);
    }
    
    if (!prepend) {
      requestAnimationFrame(() => { 
        scrollChatToBottom(); 
        setTimeout(scrollChatToBottom, 50); 
        setTimeout(scrollChatToBottom, 150); 
        setTimeout(scrollChatToBottom, 300); 
      });
    }
    
    return messageId;
  }

  async function sendChatMessage() {
    if (!state.currentTutorialId) return;
    const input = document.getElementById('medha-chat-input'); const question = input.value.trim(); if (!question) return;
    addChatMessage('user', question); input.value = '';
    state.isUserTyping = false; if (state.typingTimer) clearTimeout(state.typingTimer);
    setTimeout(() => { if (!state.isRecording) resumeVideo(); }, 500);
    
    const thinkingId = 'thinking-' + Date.now();
    const container = document.getElementById('medha-chat-messages');
    const thinkingWrapper = document.createElement('div');
    thinkingWrapper.id = thinkingId;
    thinkingWrapper.className = 'medha-chat-message medha-ai-message';
    thinkingWrapper.innerHTML = `
      <div class="medha-message-label"><span class="medha-message-icon">🤖</span><span>AI Assistant</span></div>
      <div class="medha-message-ai">
        <div class="medha-typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    container.appendChild(thinkingWrapper);
    setTimeout(scrollChatToBottom, 50);

    try {
      const response = await chrome.runtime.sendMessage({ action: 'chatWithAI', data: { tutorialId: state.currentTutorialId, question, currentTimestamp: getCurrentTime() } });
      const thinkingEl = document.getElementById(thinkingId);
      if (thinkingEl) thinkingEl.remove();
      addChatMessage('assistant', response.ai || response.answer || "No response received"); setTimeout(scrollChatToBottom, 100);
    } catch (error) {
      const thinkingEl = document.getElementById(thinkingId);
      if (thinkingEl) thinkingEl.remove();
      addChatMessage('assistant', '❌ Error: ' + error.message); setTimeout(scrollChatToBottom, 100);
    }
  }

  let chatSkip = 0;
  const chatLimit = 15;
  let chatHasMore = true;
  let isChatLoading = false;

  async function loadChatHistory(reset = true) {
    if (!state.currentTutorialId) return;
    if (isChatLoading) return;
    
    const container = document.getElementById('medha-chat-messages'); 
    if (!container) return;
    
    if (reset) {
      chatSkip = 0;
      chatHasMore = true;
      container.innerHTML = '<div class="medha-skeleton-loader"><div class="medha-skeleton-message"></div><div class="medha-skeleton-message"></div><div class="medha-skeleton-message"></div></div>';
    } else {
      // Show loading indicator at the top
      const loader = document.createElement('div');
      loader.className = 'medha-spinner';
      loader.id = 'medha-chat-top-loader';
      loader.style.cssText = 'margin: 10px auto; display: block;';
      container.insertBefore(loader, container.firstChild);
    }
    
    if (!chatHasMore) {
      const loader = document.getElementById('medha-chat-top-loader');
      if (loader) loader.remove();
      return;
    }
    
    isChatLoading = true;
    
    // Save current scroll metrics before prepending items so we can restore scroll position
    const oldScrollHeight = container.scrollHeight;
    const oldScrollTop = container.scrollTop;
    
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'getChatHistory', 
        data: { tutorialId: state.currentTutorialId, skip: chatSkip, limit: chatLimit } 
      });
      
      const history = response && response.data ? response.data : []; 
      if (history.length < chatLimit) {
        chatHasMore = false;
      }
      chatSkip += chatLimit;
      
      if (reset) {
        container.innerHTML = '';
        if (history.length > 0) {
          // Newest messages are at the end, history comes newest first from DB if sort -1
          // Wait, the backend endpoint `.sort("created_at", -1)` means history[0] is the newest.
          // We need to render oldest first (at top).
          // So reverse the array before rendering!
          const reversed = [...history].reverse();
          reversed.forEach(msg => { addChatMessage('user', msg.user, false); addChatMessage('assistant', msg.ai, false); });
          requestAnimationFrame(() => { 
            scrollChatToBottom(); setTimeout(scrollChatToBottom, 100); setTimeout(scrollChatToBottom, 300); 
          });
        } else {
          container.innerHTML = '<div class="medha-empty-state"><div class="medha-empty-icon">💬</div><div class="medha-empty-text">Ask me anything about this tutorial!</div></div>';
        }
      } else {
        const loader = document.getElementById('medha-chat-top-loader');
        if (loader) loader.remove();
        
        if (history.length > 0) {
          // Prepend items. history is newest first, so we should prepend them in order so history[0] (newest of the old batch) goes below history[1].
          // Wait, if we prepend, we insert at the top.
          // history[0] is newer than history[1]. We want history[1] ABOVE history[0].
          // So we should iterate forwards and prepend, meaning history[0] is inserted first, then history[1] is inserted ABOVE history[0]!
          history.forEach(msg => { 
            addChatMessage('assistant', msg.ai, true); 
            addChatMessage('user', msg.user, true); 
          });
          
          // Restore scroll position
          requestAnimationFrame(() => {
            container.scrollTop = oldScrollTop + (container.scrollHeight - oldScrollHeight);
          });
        }
      }
      
      if (!container.dataset.scrollAttached) {
        container.dataset.scrollAttached = "true";
        container.addEventListener('scroll', () => {
          if (container.scrollTop <= 50) {
            if (chatHasMore && !isChatLoading) {
              loadChatHistory(false);
            }
          }
        });
      }
      
    } catch (error) {
      if (reset) {
        container.innerHTML = '<div class="medha-empty-state"><div class="medha-empty-icon">💬</div><div class="medha-empty-text">Ask me anything about this tutorial!</div></div>';
      } else {
        const loader = document.getElementById('medha-chat-top-loader');
        if (loader) loader.remove();
      }
    } finally {
      isChatLoading = false;
    }
  }

  ns.features.scrollChatToBottom = scrollChatToBottom;
  ns.features.addChatMessage = addChatMessage;
  ns.features.sendChatMessage = sendChatMessage;
  ns.features.loadChatHistory = loadChatHistory;
})();


