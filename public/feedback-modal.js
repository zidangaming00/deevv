// feedback-modal.js — Modul Popup Masukan Interaktif (Loading di awal saja)
(function() {
  const style = document.createElement('style');
  style.textContent = `
    .fb-overlay {
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      padding: 16px; background: rgba(0, 0, 0, 0.5);
      opacity: 0; visibility: hidden; transition: opacity 0.2s ease, visibility 0.2s ease;
    }
    .fb-overlay.show { opacity: 1; visibility: visible; }
    
    .fb-card {
      width: 100%; max-width: 400px;
      background: var(--surface, #ffffff); color: var(--text, #1f1f1f);
      border-radius: 20px; padding: 20px 22px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
      transform: translateY(12px); transition: transform 0.2s ease;
      display: flex; flex-direction: column; gap: 14px;
      max-height: 85vh; overflow-y: auto;
    }
    .fb-overlay.show .fb-card { transform: translateY(0); }
    
    .fb-header { display: flex; align-items: center; justify-content: space-between; }
    .fb-title { font-size: 17px; font-weight: 600; }
    
    .fb-close {
      width: 32px; height: 32px; border: none; border-radius: 50%;
      background: transparent; color: var(--muted, #5f6368); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .fb-close:hover { background: var(--press, rgba(128,128,128,0.14)); color: var(--text, #1f1f1f); }
    
    .fb-desc { font-size: 13px; color: var(--muted, #5f6368); line-height: 1.4; margin-top: -4px; }
    
    .fb-section { display: flex; flex-direction: column; gap: 6px; }
    .fb-label-group { font-size: 13px; font-weight: 600; color: var(--text, #1f1f1f); }
    
    .fb-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .fb-chip {
      padding: 5px 12px; border-radius: 14px; font-size: 12.5px; font-weight: 500;
      border: 1px solid var(--line, rgba(0,0,0,0.15)); background: transparent;
      color: var(--text, #1f1f1f); cursor: pointer; transition: all 0.15s ease;
    }
    .fb-chip:hover { background: var(--press, rgba(128,128,128,0.14)); }
    .fb-chip.active {
      background: var(--primary, #1a73e8); color: #fff; border-color: var(--primary, #1a73e8);
    }

    .fb-textarea {
      width: 100%; height: 80px; padding: 10px 14px; resize: none;
      border: 1px solid var(--line, rgba(0,0,0,0.15)); border-radius: 10px;
      background: var(--bg, #f0f4f9); color: var(--text, #1f1f1f);
      font-family: inherit; font-size: 13.5px; outline: none;
    }
    .fb-textarea:focus { border-color: var(--primary, #1a73e8); }

    .fb-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 2px; }
    .fb-btn {
      height: 34px; padding: 0 16px; border-radius: 17px; font-size: 13.5px; font-weight: 500;
      cursor: pointer; border: none;
    }
    .fb-btn-cancel { background: transparent; color: var(--text, #1f1f1f); }
    .fb-btn-cancel:hover { background: var(--press, rgba(128,128,128,0.14)); }
    .fb-btn-submit { background: var(--primary, #1a73e8); color: #fff; }
    .fb-btn-submit:hover { opacity: 0.9; }

    /* Loading Circle Overlay */
    .fb-loading-wrap {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      background: var(--surface, #ffffff); border-radius: 20px; z-index: 10;
      opacity: 0; visibility: hidden; transition: opacity 0.15s ease, visibility 0.15s ease;
    }
    .fb-loading-wrap.show { opacity: 1; visibility: visible; }
    .fb-spinner {
      width: 32px; height: 32px; border: 3px solid var(--line, rgba(0,0,0,0.15));
      border-top-color: var(--primary, #1a73e8); border-radius: 50%;
      animation: fb-spin 0.7s linear infinite;
    }
    @keyframes fb-spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.className = 'fb-overlay';
  overlay.innerHTML = `
    <div class="fb-card" style="position: relative;" role="dialog" aria-modal="true">
      <div class="fb-loading-wrap" id="fb-loading">
        <div class="fb-spinner"></div>
      </div>

      <div class="fb-header">
        <span class="fb-title">Kirim Masukan</span>
        <button type="button" class="fb-close" aria-label="Tutup">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <p class="fb-desc">Bantu kami meningkatkan Deevv Search dengan memilih kategori dan memberikan ulasan.</p>
      
      <div class="fb-section">
        <div class="fb-label-group">Apa yang bisa ditingkatkan?</div>
        <div class="fb-chips" id="fb-topic-chips">
          <button type="button" class="fb-chip active" data-topic="Tampilan/UI">Tampilan / UI</button>
          <button type="button" class="fb-chip" data-topic="Fitur Pencarian">Fitur Pencarian</button>
          <button type="button" class="fb-chip" data-topic="Kecepatan">Kecepatan</button>
          <button type="button" class="fb-chip" data-topic="Lainnya">Lainnya</button>
        </div>
      </div>

      <div class="fb-section">
        <div class="fb-label-group">Bagaimana pengalaman Anda secara keseluruhan?</div>
        <div class="fb-chips" id="fb-rating-chips">
          <button type="button" class="fb-chip active" data-rating="Sangat Puas">Sangat Puas</button>
          <button type="button" class="fb-chip" data-rating="Cukup Baik">Cukup Baik</button>
          <button type="button" class="fb-chip" data-rating="Perlu Perbaikan">Perlu Perbaikan</button>
        </div>
      </div>

      <div class="fb-section">
        <div class="fb-label-group">Catatan atau Saran Tambahan</div>
        <textarea class="fb-textarea" placeholder="Tulis detail masukan Anda di sini..."></textarea>
      </div>

      <div class="fb-footer">
        <button type="button" class="fb-btn fb-btn-cancel">Batal</button>
        <button type="button" class="fb-btn fb-btn-submit">Kirim</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const textarea = overlay.querySelector('.fb-textarea');
  const closeBtn = overlay.querySelector('.fb-close');
  const cancelBtn = overlay.querySelector('.fb-btn-cancel');
  const submitBtn = overlay.querySelector('.fb-btn-submit');
  const loadingEl = overlay.querySelector('#fb-loading');

  let hasLoadedBefore = false; // Penanda apakah sudah pernah dibuka sebelumnya

  function setupChips(containerId) {
    const container = overlay.querySelector('#' + containerId);
    container.querySelectorAll('.fb-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.fb-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });
  }

  setupChips('fb-topic-chips');
  setupChips('fb-rating-chips');

  function openFeedbackModal() {
    textarea.value = '';
    overlay.classList.add('show');

    // Loading circle hanya muncul jika ini adalah klik pertama kali
    if (!hasLoadedBefore) {
      loadingEl.classList.add('show');
      setTimeout(() => {
        loadingEl.classList.remove('show');
        hasLoadedBefore = true; // Set ke true agar klik selanjutnya tidak loading lagi
      }, 650);
    }
  }

  function closeFeedbackModal() {
    overlay.classList.remove('show');
  }

  closeBtn.addEventListener('click', closeFeedbackModal);
  cancelBtn.addEventListener('click', closeFeedbackModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeFeedbackModal();
  });

  submitBtn.addEventListener('click', () => {
    const selectedTopic = overlay.querySelector('#fb-topic-chips .fb-chip.active').dataset.topic;
    const selectedRating = overlay.querySelector('#fb-rating-chips .fb-chip.active').dataset.rating;
    const detailText = textarea.value.trim();

    console.log({ topic: selectedTopic, rating: selectedRating, detail: detailText });

    if (typeof showToast === 'function') {
      showToast('Berhasil dikirim.');
    } else {
      alert('Masukan berhasil dikirim. Terima kasih!');
    }
    closeFeedbackModal();
  });

  window.openFeedbackModal = openFeedbackModal;
})();
