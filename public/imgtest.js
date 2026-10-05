// ==========================================
// CONFIGURATION & API ENDPOINTS
// ==========================================
// Ambil searchQuery dari urlParams yang sudah ada di script utama
const searchQuery = typeof urlParams !== 'undefined' ? (urlParams.get("q") || "") : "";

// API Backend (lewat serverless milik sendiri: functions/api/[[path]].js -> getImages)
const NEW_API_URL = "/api/images";

// State & Layout Controls
const container = document.querySelector(".main-result"); 
const shwrapper = document.querySelector(".show-wrapper"); 
const minWidth = 150; 
const maxColumns = 6; 
const gap = 0;

let startOffset = 0; 
let isLoading = false; 

// Pembatasan Auto-Scroll (Maksimal 2 kali nambah hasil)
let scrollCount = 0;
const maxScrolls = 2;

// ---------- Loader (elemen fixed sendiri, tidak bergantung layout .show-wrapper) ----------
let loaderEl = null;
let loaderShownAt = 0;
let loaderHideTimer = 0;
const LOADER_MIN_MS = 400; // minimal tampil biar tidak sekilas lalu hilang

function getLoader() {
    if (loaderEl) return loaderEl;
    loaderEl = document.createElement("div");
    loaderEl.className = "img-loader";
    loaderEl.setAttribute("role", "status");
    loaderEl.innerHTML = '<div class="img-loader__spin"></div>';
    document.body.appendChild(loaderEl);
    return loaderEl;
}

function showLoader(center) {
    clearTimeout(loaderHideTimer);
    loaderShownAt = Date.now();
    const el = getLoader();
    el.classList.toggle("is-center", !!center);
    el.classList.add("is-visible");
}

function clearLoader() {
    const wait = Math.max(0, LOADER_MIN_MS - (Date.now() - loaderShownAt));
    clearTimeout(loaderHideTimer);
    loaderHideTimer = setTimeout(() => {
        if (loaderEl) loaderEl.classList.remove("is-visible");
    }, wait);
    schedulePosition();
    if (typeof UI !== 'undefined' && UI.renderFooter) UI.renderFooter();
}

// ==========================================
// LAYOUT ENGINE (PERFECT EQUAL GAPS)
// ==========================================
let lastLayoutWidth = 0;
let positionRaf = 0;

function schedulePosition() {
    if (positionRaf) return;
    positionRaf = requestAnimationFrame(() => { positionRaf = 0; positionItems(); });
}

function positionItems() {
    if (!container) return;
    const items = container.querySelectorAll(".image-item");
    if (items.length === 0) return;

    const containerWidth = container.getBoundingClientRect().width;
    lastLayoutWidth = containerWidth;
    const uniformGap = 6;

    // Baca tinggi bagian info SEKALI (teks nowrap -> tinggi sama semua item).
    // Dulu item.offsetHeight dibaca di dalam loop = layout dipaksa ulang tiap item.
    const infoEl = items[0].querySelector(".image-item__info");
    const infoH = infoEl ? infoEl.offsetHeight : 40;

    let cols = Math.floor(containerWidth / (minWidth + uniformGap));
    cols = Math.max(1, Math.min(maxColumns, cols));

    const availableForItems = containerWidth - (cols + 1) * uniformGap;
    const baseWidth = Math.floor(availableForItems / cols);
    const leftoverPixels = availableForItems - baseWidth * cols;

    const columnWidths = new Array(cols).fill(baseWidth);
    for (let i = 0; i < leftoverPixels; i++) columnWidths[i] += 1;

    const columnLeft = new Array(cols);
    let cursor = uniformGap;
    for (let i = 0; i < cols; i++) {
        columnLeft[i] = cursor;
        cursor += columnWidths[i] + uniformGap;
    }

    const columnHeights = new Array(cols).fill(0);

    items.forEach((item) => {
        let col = 0;
        for (let i = 1; i < cols; i++) if (columnHeights[i] < columnHeights[col]) col = i;

        const w = columnWidths[col];
        const ratio = parseFloat(item.dataset.aspectRatio) || 1.33;
        const thumbH = Math.floor(w / ratio);
        const thumb = item.querySelector(".image-item__thumb");

        item.style.width = `${w}px`;
        if (thumb) thumb.style.height = `${thumbH}px`;
        item.style.position = "absolute";
        item.style.left = `${columnLeft[col]}px`;
        item.style.top = `${columnHeights[col]}px`;

        columnHeights[col] += thumbH + infoH + uniformGap;
    });

    container.style.height = `${Math.max(...columnHeights) + 8}px`;
}

// resize di HP sering terpanggil saat address bar naik/turun -> abaikan kalau lebar sama
window.addEventListener("resize", () => {
    if (!container) return;
    if (container.getBoundingClientRect().width === lastLayoutWidth) return;
    schedulePosition();
}); 

// ==========================================
// DATA FETCHING
// ==========================================
function fetchData(retryCount = 0) { 
    if (isLoading || !searchQuery) return; 
    isLoading = true; 
    
    const fetchUrl = `${NEW_API_URL}?q=${encodeURIComponent(searchQuery)}&type=images&start=${startOffset}&num=20`;
    
    fetch(fetchUrl)
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP Status ${response.status}`);
        }
        return response.json();
    })
    .then(response => { 
        let imageList = [];
        if (Array.isArray(response)) {
            imageList = response;
        } else if (response.results && Array.isArray(response.results)) {
            imageList = response.results;
        } else if (response.images && Array.isArray(response.images)) {
            imageList = response.images;
        }

        if (imageList.length === 0) {
            clearLoader();
            isLoading = false;
            return;
        }

        renderResults(imageList); 
        startOffset += imageList.length; 
        clearLoader();
    })
    .catch(error => { 
        isLoading = false; 
        
        // Auto-retry silent jika Railway cold-start
        if (retryCount < 2) {
            setTimeout(() => {
                fetchData(retryCount + 1);
            }, 1500);
        } else {
            clearLoader();
        }
    }); 
} 

// ==========================================
// RENDER & DOM BUILDING
// ==========================================
function renderResults(images) { 
    if (!images || !Array.isArray(images) || images.length === 0) {
        isLoading = false;
        return;
    }

    let fragment = document.createDocumentFragment(); 

    images.forEach((item, i) => {
        let imgElement = document.createElement("img"); 
        
        const thumbSrc = item.thumbnail || item.thumbnailUrl || item.image || item.imageUrl || "";
        const fullSrc = item.image || item.imageUrl || thumbSrc;
        const pageUrl = item.pageUrl || item.link || "#";
        const titleText = item.title || "Image";

        const imgWidth = item.width || item.imageWidth || 0;
        const imgHeight = item.height || item.imageHeight || 0;
        
        let aspectRatio = 1.33;
        if (imgWidth > 0 && imgHeight > 0) {
            aspectRatio = (imgWidth / imgHeight).toFixed(2);
        }

        imgElement.src = thumbSrc; 
        imgElement.loading = "lazy"; 
        imgElement.alt = titleText; 
        imgElement.style.width = "100%";
        imgElement.style.height = "100%";
        imgElement.style.objectFit = "cover";
        
        let imgContainer = document.createElement("div"); 
        imgContainer.classList.add("image-item"); 
        imgContainer.dataset.aspectRatio = aspectRatio; 
        
        let hostname = "";
        if (pageUrl && pageUrl !== "#") {
            try { hostname = new URL(pageUrl).hostname.replace(/^www\./, ''); } catch (e) {}
        }
        
        const faviconSrc = hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=32` : '';
        const siteName = item.source || item.domain || hostname || "Web";

imgContainer.innerHTML = ` 
    <div class="image-item__box"> 
        <div class="image-item__dt"> 
            <div class="image-item__thumb"></div> 
            <a class="image-item__info" href="${pageUrl}" target="_blank" rel="noopener"> 
                <p class="title" name="t">${titleText}</p> 
                <p class="image-item__desc"> 
                    <span>${siteName}</span> 
                </p> 
            </a> 
        </div> 
    </div>`;


        imgElement.decoding = "async";
        imgContainer.dataset.thumb = thumbSrc;
        imgContainer.dataset.full = fullSrc; 
        imgContainer.querySelector(".image-item__thumb").appendChild(imgElement); 
        
        imgElement.onerror = function() { 
            let parent = imgElement.closest(".image-item"); 
            if (parent) parent.remove(); 
            schedulePosition(); 
        }; 
        
        fragment.appendChild(imgContainer); 
    }); 

    if (shwrapper && shwrapper.parentNode === container) {
        container.insertBefore(fragment, shwrapper); 
    } else if (container) {
        container.appendChild(fragment);
    }

    isLoading = false; 
    positionItems(); 
} 

// ==========================================
// INFINITE SCROLL (BATAS SCROLL MAX 2X)
// ==========================================
let scrollTicking = false;

function checkLoadMore() {
    scrollTicking = false;
    if (isLoading || scrollCount >= maxScrolls || !searchQuery || !container) return;
    // satu getBoundingClientRect per frame (dulu body.offsetHeight di setiap event scroll)
    if (container.getBoundingClientRect().bottom - window.innerHeight < 300) {
        scrollCount++;
        showLoader(false);
        fetchData();
    }
}

window.addEventListener("scroll", () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(checkLoadMore);
}, { passive: true });

// Eksekusi Pemuatan Pertama
if (searchQuery) showLoader(true);
fetchData();

// ==========================================
// MOBILE PREVIEW OVERLAY + RELATED IMAGES
// ==========================================
function isMobile() { 
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent); 
} 

// ==========================================
// MOBILE PREVIEW OVERLAY (FULL CARD SLIDE ALA GOOGLE IMAGES)
// ==========================================
const targetContainer = document.querySelector(".cbKRN") || document.body;

if (targetContainer && !document.querySelector(".image-preview")) { 
    targetContainer.insertAdjacentHTML("beforeend", ` 
        <div class="image-preview" style="display:none;"> 
            <!-- Track yang menggeser 3 Seluruh Halaman Kartu Sekaligus -->
            <div class="preview-card-track">
                <div class="preview-card-page prev-page"></div>
                <div class="preview-card-page current-page"></div>
                <div class="preview-card-page next-page"></div>
            </div>

            <!-- Indikator 4 Titik Melayang -->
            <div class="preview-dots">
                <div class="preview-dot active"></div>
                <div class="preview-dot"></div>
                <div class="preview-dot"></div>
                <div class="preview-dot"></div>
            </div>
        </div> 
    `); 

    const preview = document.querySelector(".image-preview"); 
    const track = preview.querySelector(".preview-card-track");
    const prevPage = preview.querySelector(".prev-page");
    const currPage = preview.querySelector(".current-page");
    const nextPage = preview.querySelector(".next-page");

    let currentImageIndex = -1;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoveX = 0;
    let touchMoveY = 0;
    let isHorizontalSwipe = false;
    let isTouchActive = false;

    const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    // Template 1 kartu. Gambar awal = thumbnail (ringan); full-res di-upgrade hanya untuk kartu aktif.
    function createCardHTML(data) {
        if (!data) return `<div style="height:100vh;"></div>`;
        let hostname = "";
        try { if (data.pageUrl && data.pageUrl !== "#") hostname = new URL(data.pageUrl).hostname; } catch (e) {}
        const faviconSrc = hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=32` : "";

        return `
            <div class="image-preview__header"> 
                <div class="left"> 
                    <div class="image-preview__favicon"><img src="${esc(faviconSrc)}" alt="Fav" decoding="async"></div> 
                    <div class="title header-site-name">${esc(data.siteName)}</div> 
                </div> 
                <div class="right"> 
                    <div class="image-preview__favicon close-preview" style="cursor:pointer;"> 
                        <svg viewBox="0 0 24 24" height="24" width="24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg> 
                    </div> 
                </div> 
            </div> 
            <div class="image-preview__thumbnail">
                <img src="${esc(data.thumbSrc)}" data-full="${esc(data.fullSrc)}" decoding="async" alt="${esc(data.titleText)}">
            </div> 
            <div class="image-preview__footer"> 
                <div class="left"> 
                    <div class="title footer-image-title">${esc(data.titleText)}</div> 
                    <div class="site">Gambar mungkin memiliki hak cipta.</div> 
                </div> 
                <div class="right"> 
                    <button><a href="${esc(data.pageUrl)}" target="_blank" rel="noopener">Kunjungi</a></button> 
                </div> 
            </div> 
            <div class="image-preview__actions">
                <button class="action-btn share-btn" data-url="${esc(data.pageUrl)}" data-title="${esc(data.titleText)}">
                    <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
                    <span>Bagikan</span>
                </button>
                <button class="action-btn download-btn" data-img="${esc(data.fullSrc)}" data-title="${esc(data.titleText)}">
                    <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                    <span>Unduh</span>
                </button>
            </div>
            <div class="image-preview__related">
                <div class="related-title">Gambar Berikutnya</div>
                <div class="related-grid"></div>
            </div>
        `;
    }

    // Event Listener Close, Bagikan, & Unduh Button via Delegasi
    preview.addEventListener("click", (e) => {
        if (e.target.closest(".close-preview")) {
            closePreview();
            return;
        }

        // Fitur Bagikan Tautan
        const shareBtn = e.target.closest(".share-btn");
        if (shareBtn) {
            const url = shareBtn.dataset.url;
            const title = shareBtn.dataset.title;
            if (navigator.share) {
                navigator.share({ title: title, url: url }).catch(() => {});
            } else if (navigator.clipboard) {
                navigator.clipboard.writeText(url);
                alert("Tautan berhasil disalin!");
            }
            return;
        }

        // Fitur Unduh Gambar
        const downloadBtn = e.target.closest(".download-btn");
        if (downloadBtn) {
            const imgSrc = downloadBtn.dataset.img;
            const title = downloadBtn.dataset.title || "image";
            const fileName = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + ".jpg";

            if (imgSrc) {
                fetch(imgSrc)
                    .then(response => {
                        if (!response.ok) throw new Error("Gagal mengunduh gambar.");
                        return response.blob();
                    })
                    .then(blob => {
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = blobUrl;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                    })
                    .catch(() => {
                        // Fallback jika server gambar memblokir akses CORS
                        const a = document.createElement("a");
                        a.href = imgSrc;
                        a.target = "_blank";
                        a.download = fileName;
                        a.click();
                    });
            }
            return;
        }
    });

    // Delegasi Klik Gambar Utama di Grid
    document.body.addEventListener("click", (event) => { 
        const img = event.target.closest(".image-item__thumb img"); 
        if (!img) return; 
        event.preventDefault(); 
        
        const parent = img.closest(".image-item"); 
        if (!parent) return;

        const allItems = Array.from(document.querySelectorAll(".main-result .image-item"));
        const index = allItems.indexOf(parent);

        showPreviewByIndex(index); 
    }); 

    function extractDataFromElement(itemEl) {
        if (!itemEl) return null;
        return {
            titleText: itemEl.querySelector(".image-item__info .title")?.textContent || "",
            siteName: itemEl.querySelector(".image-item__desc span")?.textContent || "",
            pageUrl: itemEl.querySelector(".image-item__info")?.href || "#",
            thumbSrc: itemEl.dataset.thumb || "",
            fullSrc: itemEl.dataset.full || itemEl.dataset.thumb || "",
            ratio: parseFloat(itemEl.dataset.aspectRatio) || 1.33
        };
    }

    let cachedAllItems = [];
    let isAnimating = false;
    let dragDX = 0;
    let pageWidth = 0;
    let dragRaf = 0;
    let settleTimer = 0;
    const RELATED_COUNT = 6; // dulu 10 x 3 halaman

    // Isi 1 halaman (prev/curr/next dipakai bergantian, tidak dibuat ulang semua)
    function fillPage(page, idx) {
        page.innerHTML = createCardHTML(extractDataFromElement(cachedAllItems[idx]));
        page.scrollTop = 0;
        page.dataset.idx = idx;
        delete page.dataset.related;
    }

    // Kerja berat ditunda sampai swipe/buka selesai & user diam sebentar
    function afterSettle() {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
            const page = track.children[1];
            upgradeToFull(page);
            renderRelated(page);
        }, 120);
    }

    function upgradeToFull(page) {
        const img = page && page.querySelector(".image-preview__thumbnail img");
        if (!img || img.dataset.upgraded) return;
        img.dataset.upgraded = "1";
        const full = img.dataset.full;
        if (!full || full === img.getAttribute("src")) return;
        const hi = new Image();
        hi.decoding = "async";
        hi.src = full;
        const swap = () => { if (img.isConnected) img.src = full; };
        if (hi.decode) hi.decode().then(swap).catch(() => {});
        else hi.onload = swap;
    }

    function renderRelated(page) {
        if (!page || page.dataset.related === "1") return;
        const idx = parseInt(page.dataset.idx, 10);
        const grid = page.querySelector(".related-grid");
        if (isNaN(idx) || !grid) return;
        page.dataset.related = "1";

        const list = cachedAllItems.slice(idx + 1, idx + 1 + RELATED_COUNT);
        if (!list.length) {
            grid.innerHTML = `<div class="related-empty">Tidak ada gambar berikutnya.</div>`;
            return;
        }
        const frag = document.createDocumentFragment();
        list.forEach((el, i) => {
            const d = extractDataFromElement(el);
            const card = document.createElement("div");
            card.className = "related-card";
            card.dataset.index = idx + 1 + i;
            // aspect-ratio dipasang dari awal -> tidak ada layout shift saat gambar masuk
            card.innerHTML = `
                <div class="related-card__thumb" style="aspect-ratio:${d.ratio}">
                    <img src="${esc(d.thumbSrc)}" loading="lazy" decoding="async" alt="">
                </div>
                <div class="related-card__title">${esc(d.titleText)}</div>`;
            frag.appendChild(card);
        });
        grid.appendChild(frag);
    }

    preview.addEventListener("click", (e) => {
        const card = e.target.closest(".related-card");
        if (card) showPreviewByIndex(parseInt(card.dataset.index, 10));
    });

    function showPreviewByIndex(index) {
        cachedAllItems = Array.from(document.querySelectorAll(".main-result .image-item"));
        if (index < 0 || index >= cachedAllItems.length) return;

        currentImageIndex = index;
        preview.style.display = "block";
        document.documentElement.classList.add("preview-open");
        if (window.innerWidth < 1024) document.documentElement.style.overflow = "hidden";

        const pages = track.children;
        fillPage(pages[0], index - 1);
        fillPage(pages[1], index);
        fillPage(pages[2], index + 1);

        track.style.transition = "none";
        track.style.transform = "translate3d(-100%,0,0)";
        updateDots(index, cachedAllItems.length);
        afterSettle();
    }

    function closePreview() {
        clearTimeout(settleTimer);
        preview.style.display = "none";
        document.documentElement.classList.remove("preview-open");
        document.documentElement.style.overflow = "auto";
        for (const p of track.children) p.innerHTML = ""; // lepas gambar dari memori
    }

    // Geser 1 halaman: putar urutan DOM, isi ulang HANYA 1 halaman baru
    function rotate(dir) {
        currentImageIndex += dir;
        if (dir > 0) {
            const old = track.firstElementChild;
            track.appendChild(old);
            fillPage(old, currentImageIndex + 1);
        } else {
            const old = track.lastElementChild;
            track.insertBefore(old, track.firstElementChild);
            fillPage(old, currentImageIndex - 1);
        }
        track.style.transition = "none";
        track.style.transform = "translate3d(-100%,0,0)";
        updateDots(currentImageIndex, cachedAllItems.length);
        afterSettle();
    }

    function slide(dir) {
        isAnimating = true;
        updateDotsRealtime(-dir * pageWidth, pageWidth, currentImageIndex, cachedAllItems.length);
        track.style.transition = "transform 0.25s ease-out";
        track.style.transform = `translate3d(${-pageWidth * (1 + dir)}px,0,0)`;

        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            track.removeEventListener("transitionend", onEnd);
            rotate(dir);
            isAnimating = false;
        };
        const onEnd = (e) => { if (e.target === track) finish(); };
        track.addEventListener("transitionend", onEnd);
        setTimeout(finish, 320); // cadangan kalau transitionend tidak terpanggil
    }

    function getDotIndex(idx, totalItems) {
        if (idx <= 0) return 0;
        if (idx === 1) return 1;
        if (idx >= totalItems - 1) return 3;
        return 2;
    }

    function updateDotsRealtime(diffX, containerWidth, currentIndex, totalItems) {
        const dots = preview.querySelectorAll(".preview-dot");
        if (!dots.length) return;

        const direction = diffX < 0 ? 1 : -1;
        const targetIndex = currentIndex + direction;
        const progress = Math.min(Math.abs(diffX) / containerWidth, 1);

        const fromDotIdx = getDotIndex(currentIndex, totalItems);
        const toDotIdx = getDotIndex(targetIndex, totalItems);

        dots.forEach((dot, idx) => {
            if (fromDotIdx !== toDotIdx && idx === fromDotIdx) {
                dot.style.width = `${16 - 10 * progress}px`;
                dot.style.backgroundColor = `rgba(255, 255, 255, ${1 - 0.6 * progress})`;
            } else if (fromDotIdx !== toDotIdx && idx === toDotIdx) {
                dot.style.width = `${6 + 10 * progress}px`;
                dot.style.backgroundColor = `rgba(255, 255, 255, ${0.4 + 0.6 * progress})`;
            } else if (fromDotIdx === toDotIdx && idx === fromDotIdx) {
                dot.style.width = "16px";
                dot.style.backgroundColor = "rgba(255, 255, 255, 1)";
            } else {
                dot.style.width = "6px";
                dot.style.backgroundColor = "rgba(255, 255, 255, 0.4)";
            }
        });
    }

    function updateDots(index, totalItems) {
        const dots = preview.querySelectorAll(".preview-dot");
        const activeDotIndex = getDotIndex(index, totalItems);
        dots.forEach((d, i) => {
            d.style.transition = "";
            d.style.width = "";
            d.style.backgroundColor = "";
            d.classList.toggle("active", i === activeDotIndex);
        });
    }

    // ---------- Touch (listener passive; touch-action: pan-y di CSS) ----------
    function applyDrag() {
        dragRaf = 0;
        track.style.transform = `translate3d(${-pageWidth + dragDX}px,0,0)`;
        updateDotsRealtime(dragDX, pageWidth, currentImageIndex, cachedAllItems.length);
    }

    preview.addEventListener("touchstart", (e) => {
        if (isAnimating) return;
        touchStartX = touchMoveX = e.touches[0].clientX;
        touchStartY = touchMoveY = e.touches[0].clientY;
        isHorizontalSwipe = false;
        isTouchActive = true;
        dragDX = 0;
        pageWidth = track.clientWidth; // dibaca sekali, bukan tiap touchmove
        track.style.transition = "none";
    }, { passive: true });

    preview.addEventListener("touchmove", (e) => {
        if (!isTouchActive) return;
        touchMoveX = e.touches[0].clientX;
        touchMoveY = e.touches[0].clientY;
        const dx = touchMoveX - touchStartX;
        const dy = touchMoveY - touchStartY;

        if (!isHorizontalSwipe) {
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) isHorizontalSwipe = true;
            else return;
        }

        const last = cachedAllItems.length - 1;
        const atEdge = (currentImageIndex === 0 && dx > 0) || (currentImageIndex === last && dx < 0);
        dragDX = atEdge ? dx * 0.2 : dx;
        if (!dragRaf) dragRaf = requestAnimationFrame(applyDrag);
    }, { passive: true });

    function endDrag() {
        if (!isTouchActive) return;
        isTouchActive = false;
        if (!isHorizontalSwipe) return;
        isHorizontalSwipe = false;
        if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = 0; }

        const total = cachedAllItems.length;
        preview.querySelectorAll(".preview-dot").forEach((d) => {
            d.style.transition = "width 0.25s ease-out, background-color 0.25s ease-out";
        });

        const threshold = 60;
        if (dragDX < -threshold && currentImageIndex < total - 1) {
            slide(1);
        } else if (dragDX > threshold && currentImageIndex > 0) {
            slide(-1);
        } else {
            updateDotsRealtime(0, pageWidth, currentImageIndex, total);
            track.style.transition = "transform 0.2s ease-out";
            track.style.transform = `translate3d(${-pageWidth}px,0,0)`;
        }
    }
    preview.addEventListener("touchend", endDrag, { passive: true });
    preview.addEventListener("touchcancel", endDrag, { passive: true });
}
