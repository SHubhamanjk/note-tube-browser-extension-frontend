// Popup Script - Handles authentication and user dashboard

document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');
  const authView = document.getElementById('auth-view');
  const dashboardView = document.getElementById('dashboard-view');

  // Initialize - Check authentication status
  try {
    const { authToken } = await api.getTokens();
    if (authToken) {
      const meData = await api.getCurrentUser();
      
      // Update tokens if they were refreshed
      if (meData.access_token && meData.refresh_token) {
        await api.setTokens(meData.access_token, meData.refresh_token);
      }
      
      await showDashboard(meData);
    } else {
      showAuth();
    }
  } catch (error) {
    showAuth();
  }

  // Show authentication view
  function showAuth() {
    loading.classList.add('hidden');
    authView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
    document.getElementById('forgot-password-view').classList.add('hidden');
  }

  // Show dashboard view
  async function showDashboard(meData) {
    loading.classList.add('hidden');
    authView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    document.getElementById('forgot-password-view').classList.add('hidden');
    
    document.getElementById('user-name').textContent = meData.user ? meData.user.name : "User";
    
    // Load user stats from meData
    try {
      const tutorialsCount = meData.stats ? meData.stats.number_of_tutorials : 0;
      const notesCount = meData.stats ? meData.stats.number_of_notes : 0;
      
      document.getElementById('tutorials-count').textContent = tutorialsCount;
      document.getElementById('notes-count').textContent = notesCount;
    } catch (error) {
    }
  }

  // Tab switching (Login/Signup)
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // Update active tab
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Toggle forms
      document.getElementById('login-form').classList.toggle('hidden', tabName !== 'login');
      document.getElementById('login-otp-step').classList.add('hidden');
      document.getElementById('signup-form').classList.toggle('hidden', tabName !== 'signup');
      
      // Clear message properly
      const msgEl = document.getElementById('auth-message');
      msgEl.textContent = '';
      msgEl.className = 'message';
      if (window.authMessageTimeout) {
        clearTimeout(window.authMessageTimeout);
      }
    });
  });

  // Login handler - Initiate
  document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
      showMessage('Please enter both email and password', 'error');
      return;
    }
    
    setLoading('login-btn', true);
    
    try {
      await api.loginInitiate(email, password);
      // Hide login form, show OTP step
      document.getElementById('login-form').classList.add('hidden');
      document.getElementById('login-otp-step').classList.remove('hidden');
      showMessage('OTP sent to your email!', 'success');
    } catch (error) {
      showMessage(error.message, 'error');
    } finally {
      setLoading('login-btn', false);
    }
  });

  // Login handler - Confirm OTP
  document.getElementById('login-confirm-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const otp = document.getElementById('login-otp').value.trim();
    
    if (!otp) {
      showMessage('Please enter the OTP', 'error');
      return;
    }

    setLoading('login-confirm-btn', true);
    try {
      const result = await api.loginConfirm(email, otp);
      await api.setTokens(result.access_token, result.refresh_token);
      
      // Fetch full profile now
      const meData = await api.getCurrentUser();
      
      await showDashboard(meData);
      showMessage('Login successful! 🎉', 'success');
    } catch (error) {
      showMessage(error.message, 'error');
    } finally {
      setLoading('login-confirm-btn', false);
    }
  });

  // Signup handler
  document.getElementById('signup-btn').addEventListener('click', async () => {
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    
    // Validation
    if (!name || !email || !password) {
      showMessage('Please fill in all fields', 'error');
      return;
    }
    
    if (password.length < 6) {
      showMessage('Password must be at least 6 characters', 'error');
      return;
    }
    
    const userData = {
      name: name,
      email,
      password
    };
    
    setLoading('signup-btn', true);
    
    try {
      await api.signup(userData);
      // Switch to login tab
      document.querySelector('.tab[data-tab="login"]').click();
      // Show message after switching so it doesn't get cleared
      showMessage('Account created! Please log in.', 'success');
    } catch (error) {
      showMessage(error.message, 'error');
    } finally {
      setLoading('signup-btn', false);
    }
  });

  // Logout handler
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api.clearTokens();
    
    // Clear forms
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('signup-name').value = '';
    document.getElementById('signup-email').value = '';
    document.getElementById('signup-password').value = '';
    
    showAuth();
    showMessage('Logged out successfully', 'success');
  });







  // Donate button
  document.getElementById('donate-btn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'showFuelMission' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          if (tabs[0].url && tabs[0].url.includes('youtube.com/watch')) {
            chrome.tabs.reload(tabs[0].id);
            window.close();
          } else {
            alert("Please navigate to a YouTube video page (youtube.com/watch).");
          }
        } else {
          window.close();
        }
      });
    });
  });

  // Force Launch button
  document.getElementById('force-launch-btn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'forceLaunch' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          if (tabs[0].url && tabs[0].url.includes('youtube.com/watch')) {
            chrome.tabs.reload(tabs[0].id);
            window.close();
          } else {
            alert("Please navigate to a YouTube video page (youtube.com/watch).");
          }
        } else {
          window.close();
        }
      });
    });
  });

  // Forgot Password Link
  document.getElementById('forgot-password-link').addEventListener('click', (e) => {
    e.preventDefault();
    showForgotPassword();
  });

  // Forgot Password - Step 1: Send OTP
  document.getElementById('send-otp-btn').addEventListener('click', async () => {
    const email = document.getElementById('forgot-email').value.trim();
    
    if (!email) {
      showForgotMessage('Please enter your email address', 'error');
      return;
    }

    setLoading('send-otp-btn', true);

    try {
      await api.forgotPassword(email);
      document.getElementById('forgot-email-display').textContent = email;
      
      // Move to OTP step
      document.getElementById('forgot-email-step').classList.add('hidden');
      document.getElementById('forgot-otp-step').classList.remove('hidden');
      document.getElementById('forgot-subtitle').textContent = 'Verify OTP';
      
      showForgotMessage('OTP sent! Check your email.', 'success');
    } catch (error) {
      showForgotMessage(error.message || 'Failed to send OTP. Please try again.', 'error');
    } finally {
      setLoading('send-otp-btn', false);
    }
  });

  // Forgot Password - Step 2: Verify OTP
  document.getElementById('verify-otp-btn').addEventListener('click', async () => {
    const email = document.getElementById('forgot-email').value.trim();
    const otp = document.getElementById('forgot-otp').value.trim();
    
    if (!otp || otp.length !== 6) {
      showForgotMessage('Please enter the 6-digit OTP', 'error');
      return;
    }

    setLoading('verify-otp-btn', true);

    try {
      const response = await api.verifyOtp(email, otp);
      
      if (response.verified && response.reset_token) {
        // Store reset token temporarily
        window.resetToken = response.reset_token;
        
        // Move to password step
        document.getElementById('forgot-otp-step').classList.add('hidden');
        document.getElementById('forgot-password-step').classList.remove('hidden');
        document.getElementById('forgot-subtitle').textContent = 'Set New Password';
        
        showForgotMessage('OTP verified! Enter your new password.', 'success');
      }
    } catch (error) {
      showForgotMessage(error.message || 'Invalid or expired OTP', 'error');
    } finally {
      setLoading('verify-otp-btn', false);
    }
  });

  // Forgot Password - Step 3: Reset Password
  document.getElementById('reset-password-btn').addEventListener('click', async () => {
    const email = document.getElementById('forgot-email').value.trim();
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (!newPassword || !confirmPassword) {
      showForgotMessage('Please fill in all fields', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showForgotMessage('Passwords do not match', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showForgotMessage('Password must be at least 6 characters', 'error');
      return;
    }

    setLoading('reset-password-btn', true);

    try {
      await api.resetPassword(email, window.resetToken, newPassword);
      
      showForgotMessage('Password reset successful! Redirecting to login...', 'success');
      
      // Clear form and redirect after 2 seconds
      setTimeout(() => {
        resetForgotPasswordForm();
        showAuth();
      }, 2000);
    } catch (error) {
      showForgotMessage(error.message || 'Failed to reset password', 'error');
    } finally {
      setLoading('reset-password-btn', false);
    }
  });

  // Resend OTP
  document.getElementById('resend-otp-btn').addEventListener('click', async () => {
    const email = document.getElementById('forgot-email').value.trim();
    
    setLoading('resend-otp-btn', true);

    try {
      await api.forgotPassword(email);
      showForgotMessage('OTP resent! Check your email.', 'success');
    } catch (error) {
      showForgotMessage(error.message || 'Failed to resend OTP', 'error');
    } finally {
      setLoading('resend-otp-btn', false);
    }
  });

  // Back to Login button
  document.getElementById('back-to-login-1').addEventListener('click', () => {
    resetForgotPasswordForm();
    showAuth();
  });

  // Enter key listeners
  document.getElementById('login-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('login-btn').click();
    }
  });

  document.getElementById('signup-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('signup-btn').click();
    }
  });

  document.getElementById('forgot-email').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('send-otp-btn').click();
    }
  });

  document.getElementById('forgot-otp').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('verify-otp-btn').click();
    }
  });

  document.getElementById('confirm-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('reset-password-btn').click();
    }
  });

  // OTP input - only allow digits
  document.getElementById('forgot-otp').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  });

  // Show forgot password view
  function showForgotPassword() {
    loading.classList.add('hidden');
    authView.classList.add('hidden');
    dashboardView.classList.add('hidden');
    document.getElementById('forgot-password-view').classList.remove('hidden');
    resetForgotPasswordForm();
  }

  // Reset forgot password form
  function resetForgotPasswordForm() {
    document.getElementById('forgot-email').value = '';
    document.getElementById('forgot-otp').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
    document.getElementById('forgot-email-step').classList.remove('hidden');
    document.getElementById('forgot-otp-step').classList.add('hidden');
    document.getElementById('forgot-password-step').classList.add('hidden');
    document.getElementById('forgot-subtitle').textContent = 'Reset your password';
    document.getElementById('forgot-message').textContent = '';
    document.getElementById('forgot-message').className = 'message';
    window.resetToken = null;
  }

  // Helper functions
  function showMessage(message, type) {
    const messageEl = document.getElementById('auth-message');
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    
    if (window.authMessageTimeout) {
      clearTimeout(window.authMessageTimeout);
    }
    
    // Clear after 5 seconds
    window.authMessageTimeout = setTimeout(() => {
      messageEl.textContent = '';
      messageEl.className = 'message';
    }, 5000);
  }

  function showForgotMessage(message, type) {
    const messageEl = document.getElementById('forgot-message');
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    
    // Clear after 5 seconds
    setTimeout(() => {
      messageEl.textContent = '';
      messageEl.className = 'message';
    }, 5000);
  }

  function setLoading(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    if (isLoading) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.textContent = 'Loading...';
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || button.textContent;
    }
  }

  // Fuel the Mission Modal for Popup
  function showFuelMissionModal() {
    const UPI_ID = '8002007238-2@axl'; 
    
    function getQRCodeImage() {
      return chrome.runtime.getURL('assets/qr.jpg');
    }

    const modal = document.createElement('div');
    modal.id = 'popup-fuel-modal';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0, 0, 0, 0.9); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px;';
    
    const qrCodeUrl = getQRCodeImage();
    
    modal.innerHTML = `
      <div style="background: var(--popup-bg-primary); border: 1px solid var(--popup-border); border-radius: 12px; width: 100%; max-width: 450px; max-height: 90vh; overflow-y: auto; position: relative;">
        <div style="padding: 20px; border-bottom: 1px solid var(--popup-border); display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; font-size: 20px; color: var(--popup-primary);">⚡ Fuel the Mission</h2>
          <button id="close-popup-fuel" style="background: transparent; border: none; color: var(--popup-text-secondary); font-size: 24px; cursor: pointer; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 4px;">×</button>
        </div>
        <div style="padding: 24px;">
          <div style="margin-bottom: 24px;">
            <p style="font-size: 16px; font-weight: 600; color: var(--popup-text-primary); margin: 0 0 12px 0; text-align: center;">Keep the Learning Engine Running</p>
            <p style="font-size: 13px; color: var(--popup-text-secondary); line-height: 1.6; margin: 0 0 16px 0;">
              Medha.ai is built with passion to make learning accessible and powerful. Your support helps us maintain infrastructure, enhance AI capabilities, add new features, and keep everything free for learners worldwide.
            </p>
            <ul style="list-style: none; padding: 0; margin: 0 0 16px 0;">
              <li style="font-size: 12px; color: var(--popup-text-primary); line-height: 1.8; padding: 6px 0 6px 20px; position: relative;">Maintain and improve server infrastructure</li>
              <li style="font-size: 12px; color: var(--popup-text-primary); line-height: 1.8; padding: 6px 0 6px 20px; position: relative;">Enhance AI capabilities and response quality</li>
              <li style="font-size: 12px; color: var(--popup-text-primary); line-height: 1.8; padding: 6px 0 6px 20px; position: relative;">Add new features and keep everything free</li>
              <li style="font-size: 12px; color: var(--popup-text-primary); line-height: 1.8; padding: 6px 0 6px 20px; position: relative;">Scale to serve more learners worldwide</li>
            </ul>
            <p style="font-size: 12px; color: var(--popup-text-secondary); line-height: 1.6; margin: 16px 0 0 0; font-style: italic; text-align: center;">
              Every contribution fuels our mission to democratize quality education. Thank you! 🙏
            </p>
          </div>
          <div style="display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 20px; background: var(--popup-bg-secondary); border-radius: 8px; border: 1px solid var(--popup-border);">
            <div>
              <p style="font-size: 12px; color: var(--popup-text-secondary); margin: 0 0 12px 0; font-weight: 500; text-align: center;">Scan to contribute via UPI</p>
              <img src="${qrCodeUrl}" alt="UPI QR Code" style="width: 200px; height: 200px; border: none; border-radius: 0; padding: 0; background: white; display: block; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; object-fit: contain;" />
            </div>
            <div style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <p style="font-size: 11px; color: var(--popup-text-secondary); margin: 0;">Or send directly to:</p>
              <div style="display: flex; gap: 8px; width: 100%; max-width: 280px;">
                <input type="text" id="popup-upi-id" value="${UPI_ID}" readonly style="flex: 1; padding: 10px; background: var(--popup-bg-tertiary); border: 1px solid var(--popup-border); border-radius: 6px; color: var(--popup-text-primary); font-size: 13px; font-family: monospace; text-align: center;" />
                <button id="popup-copy-upi" style="padding: 10px 16px; background: var(--popup-primary); border: none; border-radius: 6px; color: white; font-size: 14px; cursor: pointer;">📋</button>
              </div>
            </div>
          </div>
          <p style="font-size: 11px; color: var(--popup-text-secondary); margin: 16px 0 0 0; text-align: center;">💝 Your support means the world to us!</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('close-popup-fuel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    
    document.getElementById('popup-copy-upi').addEventListener('click', () => {
      const upiInput = document.getElementById('popup-upi-id');
      upiInput.select();
      upiInput.setSelectionRange(0, 99999);
      try {
        document.execCommand('copy');
        const copyBtn = document.getElementById('popup-copy-upi');
        const original = copyBtn.textContent;
        copyBtn.textContent = '✓';
        setTimeout(() => { copyBtn.textContent = original; }, 2000);
      } catch (err) {
        upiInput.select();
      }
    });
  }
});

