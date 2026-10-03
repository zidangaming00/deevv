// script.js - Pure Client-Side UI & State Manager

const App = {
  state: {
    query: "",
    tab: "all",
    page: 1,
    isLoading: false
  },

  init() {
    this.cacheDOM();
    this.bindEvents();

    // Hydration awal dari server SSR Data
    if (window.__SSR_DATA__) {
      this.state.query = window.__SSR_DATA__.query || "";
      this.state.tab = window.__SSR_DATA__.tab || "all";
      this.state.page = window.__SSR_DATA__.page || 1;
      this.render(window.__SSR_DATA__);
    }
  },

  cacheDOM() {
    this.searchInput = document.getElementById("search-input");
    this.resultsContainer = document.getElementById("results-container");
    this.tabButtons = document.querySelectorAll(".tab-item");
  },

  bindEvents() {
    // Event listener perbandingan tab
    this.tabButtons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const selectedTab = e.currentTarget.dataset.tab;
        if (selectedTab !== this.state.tab && !this.state.isLoading) {
          this.switchTab(selectedTab);
        }
      });
    });

    // Handle submit form pencarian
    if (this.searchInput) {
      this.searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && this.searchInput.value.trim() !== "") {
          this.state.query = this.searchInput.value.trim();
          this.state.page = 1;
          this.fetchAndRender();
        }
      });
    }
  },

  async switchTab(newTab) {
    this.state.tab = newTab;
    this.state.page = 1;

    // Update kelas UI Tab aktif
    this.tabButtons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === newTab);
    });

    await this.fetchAndRender();
  },

  async fetchAndRender() {
    this.state.isLoading = true;
    this.showLoadingState();

    try {
      // Request murni ke serverless gateway internal (/api/search)
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(this.state.query)}&tab=${this.state.tab}&page=${this.state.page}`
      );

      if (!response.ok) throw new Error("Gagal mengambil data dari server");

      const data = await response.json();
      this.render(data);

      // Update URL browser tanpa reload halaman (History API)
      const newURL = `/?q=${encodeURIComponent(this.state.query)}&tab=${this.state.tab}&page=${this.state.page}`;
      window.history.pushState({ path: newURL }, "", newURL);

    } catch (error) {
      console.error("UI Render Error:", error);
      this.resultsContainer.innerHTML = `<div class="error-msg">Gagal memuat hasil pencarian. Silakan coba lagi.</div>`;
    } finally {
      this.state.isLoading = false;
    }
  },

  showLoadingState() {
    this.resultsContainer.innerHTML = `
      <div class="loading-skeleton">
        <div class="skeleton-line header-skel"></div>
        <div class="skeleton-line text-skel"></div>
        <div class="skeleton-line text-skel"></div>
      </div>
    `;
  },

  // RENDERER UTAMA - Mengatur Elemen Sesuai Tab Tanpa Merubah DOM/CSS Standard
  render(data) {
    this.resultsContainer.innerHTML = "";

    switch (data.tab) {
      case "images":
        this.resultsContainer.appendChild(UIBuilder.buildImagesLayout(data.results));
        break;
      case "videos":
        this.resultsContainer.appendChild(UIBuilder.buildVideosLayout(data.results));
        break;
      case "news":
        this.resultsContainer.appendChild(UIBuilder.buildNewsLayout(data.results));
        break;
      case "all":
      default:
        this.resultsContainer.appendChild(UIBuilder.buildAllTabLayout(data));
        break;
    }

    // Render Pagination
    if (data.pagination) {
      this.resultsContainer.appendChild(UIBuilder.buildPagination(data.pagination, (newPage) => {
        this.state.page = newPage;
        this.fetchAndRender();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }));
    }
  }
};

// ==========================================
// UI BUILDER (MEMPERTAHANKAN BENTUK & KELAS DOM)
// ==========================================

const UIBuilder = {
  buildAllTabLayout(data) {
    const fragment = document.createDocumentFragment();

    // 1. AI Overview Container (Jika ada data dari server)
    if (data.aiOverview) {
      const aiBox = document.createElement("div");
      aiBox.className = "ai-overview-container";
      aiBox.innerHTML = `
        <div class="ai-overview-header">
          <span class="ai-sparkle-icon">✨</span>
          <h3>Ringkasan AI</h3>
        </div>
        <div class="ai-overview-content">${escapeHTML(data.aiOverview)}</div>
      `;
      fragment.appendChild(aiBox);
    }

    // 2. Container Hasil Utama Web (`resultsListInner`)
    const resultsListInner = document.createElement("div");
    resultsListInner.id = "resultsListInner";

    if (data.results && data.results.length > 0) {
      data.results.forEach((item, index) => {
        const itemEl = document.createElement("div");
        itemEl.className = "web-result-item";
        itemEl.innerHTML = `
          <div class="result-site-info">
            <cite class="result-url">${escapeHTML(item.displayUrl || item.url)}</cite>
          </div>
          <h2 class="result-title">
            <a href="${escapeHTML(item.url)}" target="_blank" rel="noopener">${escapeHTML(item.title)}</a>
          </h2>
          <p class="result-snippet">${escapeHTML(item.snippet)}</p>
        `;
        resultsListInner.appendChild(itemEl);

        // Pertahankan slot khusus untuk dynamic widget di indeks ke-1
        if (index === 1) {
          const videoSlot = document.createElement("div");
          videoSlot.id = "dynamic-video-widget-slot";
          resultsListInner.appendChild(videoSlot);
        }
      });
    } else {
      resultsListInner.innerHTML = `<p class="no-results">Tidak ada hasil web yang ditemukan.</p>`;
    }

    fragment.appendChild(resultsListInner);

    // 3. Related Searches Widget
    if (data.relatedSearches && data.relatedSearches.length > 0) {
      const relatedBox = document.createElement("div");
      relatedBox.className = "related-searches-box";
      relatedBox.innerHTML = `<h3>Pencarian Terkait</h3>`;
      const list = document.createElement("ul");
      data.relatedSearches.forEach(term => {
        const li = document.createElement("li");
        li.textContent = term;
        li.addEventListener("click", () => {
          App.searchInput.value = term;
          App.state.query = term;
          App.state.page = 1;
          App.fetchAndRender();
        });
        list.appendChild(li);
      });
      relatedBox.appendChild(list);
      fragment.appendChild(relatedBox);
    }

    return fragment;
  },

  buildImagesLayout(results) {
    const container = document.createElement("div");
    container.className = "image-grid-container";
    if (!results || results.length === 0) {
      container.innerHTML = `<p class="no-results">Tidak ada gambar ditemukan.</p>`;
      return container;
    }
    results.forEach(img => {
      const card = document.createElement("div");
      card.className = "image-card";
      card.innerHTML = `
        <a href="${escapeHTML(img.link)}" target="_blank" rel="noopener">
          <img src="${escapeHTML(img.thumbnail)}" alt="${escapeHTML(img.title)}" loading="lazy" />
          <span class="image-title">${escapeHTML(img.title)}</span>
        </a>
      `;
      container.appendChild(card);
    });
    return container;
  },

  buildVideosLayout(results) {
    const container = document.createElement("div");
    container.className = "video-list-container";
    if (!results || results.length === 0) {
      container.innerHTML = `<p class="no-results">Tidak ada video ditemukan.</p>`;
      return container;
    }
    results.forEach(vid => {
      const item = document.createElement("div");
      item.className = "video-item";
      item.innerHTML = `
        <div class="video-thumb">
          <img src="${escapeHTML(vid.thumbnail)}" alt="${escapeHTML(vid.title)}" />
        </div>
        <div class="video-info">
          <h3><a href="${escapeHTML(vid.link)}" target="_blank" rel="noopener">${escapeHTML(vid.title)}</a></h3>
          <p>${escapeHTML(vid.snippet || '')}</p>
        </div>
      `;
      container.appendChild(item);
    });
    return container;
  },

  buildNewsLayout(results) {
    const container = document.createElement("div");
    container.className = "news-list-container";
    if (!results || results.length === 0) {
      container.innerHTML = `<p class="no-results">Tidak ada berita ditemukan.</p>`;
      return container;
    }
    results.forEach(news => {
      const item = document.createElement("div");
      item.className = "news-item";
      item.innerHTML = `
        <span class="news-source">${escapeHTML(news.source || '')}</span>
        <h3><a href="${escapeHTML(news.link)}" target="_blank" rel="noopener">${escapeHTML(news.title)}</a></h3>
        <p>${escapeHTML(news.snippet || '')}</p>
      `;
      container.appendChild(item);
    });
    return container;
  },

  buildPagination(pagination, onPageClick) {
    const nav = document.createElement("nav");
    nav.className = "pagination-nav";

    if (pagination.hasPrev) {
      const prevBtn = document.createElement("button");
      prevBtn.textContent = "Sebelumnya";
      prevBtn.addEventListener("click", () => onPageClick(pagination.currentPage - 1));
      nav.appendChild(prevBtn);
    }

    const pageSpan = document.createElement("span");
    pageSpan.className = "page-number";
    pageSpan.textContent = `Halaman ${pagination.currentPage || 1}`;
    nav.appendChild(pageSpan);

    if (pagination.hasNext) {
      const nextBtn = document.createElement("button");
      nextBtn.textContent = "Berikutnya";
      nextBtn.addEventListener("click", () => onPageClick(pagination.currentPage + 1));
      nav.appendChild(nextBtn);
    }

    return nav;
  }
};

function escapeHTML(str) {
  return String(str || "").replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

document.addEventListener("DOMContentLoaded", () => App.init());
