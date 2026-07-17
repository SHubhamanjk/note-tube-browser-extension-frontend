(function setupFuelMission() {
  'use strict';

  const ns = window.Medha || (window.Medha = {});
  ns.features = ns.features || {};
  const { showNotification } = ns;

  const UPI_ID = '8002007238-2@axl'; 
  
  // Get QR code image from assets
  function getQRCodeImage() {
    const qrImageUrl = chrome.runtime.getURL('assets/qr.jpg');
    // Verify the image exists and can be loaded
    return qrImageUrl;
  }

  function showFuelMissionModal() {
    const existing = document.getElementById('medha-fuel-mission-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'medha-fuel-mission-modal';
    modal.className = 'medha-fuel-mission-modal';
    
    const qrCodeUrl = getQRCodeImage();
    
    // Verify QR code URL
    
    modal.innerHTML = `
      <div class="medha-fuel-mission-content">
        <div class="medha-fuel-mission-header">
          <h2>💝 Fuel the Mission</h2>
          <button id="medha-close-fuel-modal" class="medha-close-btn">×</button>
        </div>
        <div class="medha-fuel-mission-body">
          <div class="medha-fuel-mission-message">
            <p class="fuel-title">Keep the Learning Engine Running</p>
            <p class="fuel-description">
              Medha.ai is built with passion to make learning accessible and powerful. 
              Your support helps us:
            </p>
            <ul class="fuel-benefits">
              <li>Maintain and improve server infrastructure</li>
              <li>Enhance AI capabilities and response quality</li>
              <li>Add new features and keep everything free</li>
              <li>Scale to serve more learners worldwide</li>
              <li>Ensure data security and privacy</li>
            </ul>
            <p class="fuel-appreciation">
              Every contribution, big or small, fuels our mission to democratize quality education. 
              Thank you for being part of this journey! 🙏
            </p>
          </div>
          
          <div class="medha-fuel-mission-payment">
            <div class="fuel-qr-container">
              <p class="fuel-scan-text">Scan to contribute via UPI</p>
              <img src="${qrCodeUrl}" alt="UPI QR Code" class="fuel-qr-code" />
            </div>
            <div class="fuel-upi-info">
              <p class="fuel-upi-label">Or send directly to:</p>
              <div class="fuel-upi-id-container">
                <input type="text" id="fuel-upi-id" class="fuel-upi-id" value="${UPI_ID}" readonly />
                <button id="fuel-copy-upi" class="fuel-copy-btn" title="Copy UPI ID">📋</button>
              </div>
            </div>
          </div>
        </div>
        <div class="medha-fuel-mission-footer">
          <p class="fuel-footer-note">💝 Your support means the world to us!</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close button
    document.getElementById('medha-close-fuel-modal').addEventListener('click', () => {
      modal.remove();
    });
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
    // Copy UPI ID button
    document.getElementById('fuel-copy-upi').addEventListener('click', () => {
      const upiInput = document.getElementById('fuel-upi-id');
      upiInput.select();
      upiInput.setSelectionRange(0, 99999); // For mobile devices
      
      try {
        document.execCommand('copy');
        showNotification && showNotification('✅ UPI ID copied to clipboard!', 'success');
        
        // Visual feedback
        const copyBtn = document.getElementById('fuel-copy-upi');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✓';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      } catch (err) {
        // Fallback: select text
        upiInput.select();
        showNotification && showNotification('📋 UPI ID selected - press Ctrl+C to copy', 'info');
      }
    });
    
    // ESC key to close
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  }

  ns.features.showFuelMissionModal = showFuelMissionModal;
})();

