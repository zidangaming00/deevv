// ==========================================
// CONFIGURATION & API ENDPOINTS
// ==========================================
// Ambil searchQuery dari urlParams yang sudah ada di script utama
const searchQuery = typeof urlParams !== 'undefined' ? (urlParams.get("q") || "") : "";

// API Backend
const NEW_API_URL = "https://deevv-api-production.up.railway.app/api/search";

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

// Helper hapus loader
function clearLoader() {
    if (shwrapper) {
        shwrapper.innerHTML = ''; 
        shwrapper.style.position = 'absolute'; 
    }
}

// ==========================================
// LAYOUT ENGINE (PERFECT EQUAL GAPS)
// ==========================================
function positionItems() { 
    if (!container) return;
    const items = Array.from(container.querySelectorAll(".image-item")); 
    if (items.length === 0) return; 

    const containerWidth = container.getBoundingClientRect().width;
    const uniformGap = 6;

    let cols = Math.floor(containerWidth / (minWidth + uniformGap)); 
    cols = Math.max(1, Math.min(maxColumns, cols)); 

    // Total ruang gap: kiri (1) + tengah (cols-1) + kanan (1)
    const totalGapSpace = (cols + 1) * uniformGap;

    // Lebar total yang tersisa untuk semua gambar (gabungan semua kolom)
    const availableForItems = containerWidth - totalGapSpace;

    // Lebar dasar tiap kolom (integer, dibulatkan ke bawah)
    const baseWidth = Math.floor(availableForItems / cols);

    // Sisa piksel akibat pembulatan -> bagikan SEBAGAI INTEGER +1px
    // ke beberapa kolom PERTAMA saja, bukan pecahan desimal ke semua
    const leftoverPixels = availableForItems - baseWidth * cols;

    // Array lebar tiap kolom (integer semua, totalnya PASTI = availableForItems)
    const columnWidths = new Array(cols).fill(baseWidth);
    for (let i = 0; i < leftoverPixels; i++) {
        columnWidths[i] += 1;
    }

    // Hitung posisi X kiri tiap kolom secara kumulatif (bukan colIndex * itemWidth)
    const columnLeftPositions = new Array(cols);
    let cursor = uniformGap; // margin kiri
    for (let i = 0; i < cols; i++) {
        columnLeftPositions[i] = cursor;
        cursor += columnWidths[i] + uniformGap;
    }
    // Sekarang cursor (setelah loop) = containerWidth - uniformGap + uniformGap
    // = containerWidth persis, sehingga margin kanan otomatis pas = uniformGap

    let columnHeights = new Array(cols).fill(0); 

    items.forEach((item) => { 
        let colIndex = columnHeights.indexOf(Math.min(...columnHeights)); 
        let itemWidth = columnWidths[colIndex];
        let imgThumb = item.querySelector(".image-item__thumb"); 
        
        item.style.width = `${itemWidth}px`; 
        
        if (imgThumb) {
            const ratio = parseFloat(item.dataset.aspectRatio) || 1.33;
            imgThumb.style.height = `${Math.floor(itemWidth / ratio)}px`;
        } 

        let topPos = columnHeights[colIndex]; 
        let leftPos = columnLeftPositions[colIndex];

        item.style.position = "absolute"; 
        item.style.left = `${leftPos}px`; 
        item.style.top = `${topPos}px`; 

        columnHeights[colIndex] += item.offsetHeight + uniformGap; 
    }); 

    container.style.height = `${Math.max(...columnHeights) + 80}px`; 
}
window.addEventListener("resize", positionItems); 

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


        loadImage(imgElement, thumbSrc, fullSrc); 
        imgContainer.querySelector(".image-item__thumb").appendChild(imgElement); 
        
        imgElement.onerror = function() { 
            let parent = imgElement.closest(".image-item"); 
            if (parent) parent.remove(); 
            positionItems(); 
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

function loadImage(imgElement, thumbnailSrc, fullSrc) { 
    imgElement.src = thumbnailSrc; 
    imgElement.style.filter = "blur(2px)"; 
    imgElement.style.transition = "filter .3s ease-in-out"; 
    
    if (fullSrc && fullSrc !== thumbnailSrc) {
        const fullImage = new Image(); 
        fullImage.src = fullSrc; 
        fullImage.onload = function() { 
            imgElement.src = fullSrc; 
            imgElement.style.filter = "blur(0)"; 
        };
        fullImage.onerror = function() {
            imgElement.style.filter = "blur(0)";
        };
    } else {
        imgElement.style.filter = "blur(0)";
    }
} 

// ==========================================
// INFINITE SCROLL (BATAS SCROLL MAX 2X)
// ==========================================
window.addEventListener("scroll", function() { 
    if (isLoading || scrollCount >= maxScrolls) return; 

    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) { 
        scrollCount++; 
        
        if (shwrapper) {
            shwrapper.innerHTML = `<div class="loader"><svg class="circular" viewBox="25 25 50 50"><circle class="path" cx="50" cy="50" r="20" fill="none" stroke-width="4" stroke-miterlimit="10"/></svg></div>`; 
            shwrapper.style.position = 'static';
        }
        fetchData(); 
    } 
}); 

// Eksekusi Pemuatan Pertama
fetchData();

// ==========================================
// MOBILE PREVIEW OVERLAY + RELATED IMAGES
// ==========================================
function isMobile() { 
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent); 
} 

// ==========================================
// MOBILE PREVIEW OVERLAY + REAL SLIDE CAROUSEL + FLOATING DOTS
// ==========================================
const targetContainer = document.querySelector(".cbKRN") || document.body;

if (targetContainer && !document.querySelector(".image-preview")) { 
    targetContainer.insertAdjacentHTML("beforeend", ` 
        <div class="image-preview" style="display:none;"> 
            <div class="image-preview__header"> 
                <div class="left"> 
                    <div class="image-preview__favicon"><img src="" alt="Favicon"></div> 
                    <div class="title header-site-name"></div> 
                </div> 
                <div class="right"> 
                    <div class="image-preview__favicon close-preview" style="cursor:pointer;"> 
                        <svg viewBox="0 0 24 24" focusable="false" height="24" width="24"> 
                            <path d="M0 0h24v24H0z" fill="none"></path> 
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path> 
                        </svg> 
                    </div> 
                </div> 
            </div> 
            <div class="image-preview__body">
                <!-- Track Carousel untuk Slide nyata antar Gambar -->
                <div class="image-preview__thumbnail">
                    <div class="preview-carouselTrack">
                        <div class="preview-slide prev-slide"><img src="" alt="Prev"></div>
                        <div class="preview-slide current-slide"><img src="" alt="Current"></div>
                        <div class="preview-slide next-slide"><img src="" alt="Next"></div>
                    </div>
                </div> 

                <div class="image-preview__footer"> 
                    <div class="left"> 
                        <div class="title footer-image-title"></div> 
                        <div class="site">Gambar mungkin memiliki hak cipta.</div> 
                    </div> 
                    <div class="right"> 
                        <button><a href="" target="_blank" rel="noopener" class="visit-link">Kunjungi</a></button> 
                    </div> 
                </div> 
                
                <!-- SECTION RELATED IMAGES (Local DOM) -->
                <div class="image-preview__related">
                    <div class="related-grid"></div>
                </div>
            </div>

            <!-- Indikator 4 Titik Melayang Ala Google -->
            <div class="preview-dots">
                <div class="preview-dot active"></div>
                <div class="preview-dot"></div>
                <div class="preview-dot"></div>
                <div class="preview-dot"></div>
            </div>
        </div> 
    `); 

    const preview = document.querySelector(".image-preview"); 
    const track = preview.querySelector(".preview-carouselTrack");
    const prevImg = preview.querySelector(".prev-slide img");
    const currImg = preview.querySelector(".current-slide img");
    const nextImg = preview.querySelector(".next-slide img");

    let currentImageIndex = -1;
    let touchStartX = 0;
    let touchMoveX = 0;
    let isSwiping = false;
    
    function hidePreview() { 
        if (preview) preview.style.display = "none"; 
        document.documentElement.style.overflow = "auto"; 
    } 
    
    const closeBtn = document.querySelector(".close-preview");
    if (closeBtn) closeBtn.addEventListener("click", hidePreview); 
    
    // Delegasi Klik Gambar Utama
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
        const img = itemEl.querySelector(".image-item__thumb img");
        return {
            titleText: itemEl.querySelector(".image-item__info .title")?.innerText || "",
            siteName: itemEl.querySelector(".image-item__desc span")?.innerText || "",
            pageUrl: itemEl.querySelector(".image-item__info")?.href || "#",
            imgSrc: img ? img.src : ""
        };
    }

    function showPreviewByIndex(index, animateDirection = 0) {
        const allItems = Array.from(document.querySelectorAll(".main-result .image-item"));
        if (index < 0 || index >= allItems.length) return;

        currentImageIndex = index;
        const currentData = extractDataFromElement(allItems[index]);
        if (!currentData) return;

        const bodyElem = preview.querySelector(".image-preview__body");
        if (bodyElem && animateDirection === 0) bodyElem.scrollTop = 0;

        preview.style.display = "flex"; 
        document.documentElement.style.overflow = "hidden"; 
        
        // Atur Gambar Kiri (Prev), Tengah (Current), Kanan (Next) untuk Efek Slide
        const prevData = extractDataFromElement(allItems[index - 1]);
        const nextData = extractDataFromElement(allItems[index + 1]);

        prevImg.src = prevData ? prevData.imgSrc : "";
        currImg.src = currentData.imgSrc;
        nextImg.src = nextData ? nextData.imgSrc : "";

        // Reset Transform Track ke Tengah (-100%)
        track.style.transition = animateDirection !== 0 ? "transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)" : "none";
        track.style.transform = `translateX(-100%)`;

        // Update Info Text Header & Footer
        preview.querySelector(".footer-image-title").innerText = currentData.titleText; 
        preview.querySelector(".header-site-name").innerText = currentData.siteName; 
        preview.querySelector(".visit-link").href = currentData.pageUrl; 
        
        const hostname = currentData.pageUrl && currentData.pageUrl !== "#" ? new URL(currentData.pageUrl).hostname : "";
        if (hostname) {
            preview.querySelector(".image-preview__favicon img").src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
        }

        updateDots(index, allItems.length);
        renderLocalRelatedImages(index, allItems);
    }

    function updateDots(index, totalItems) {
        const dots = preview.querySelectorAll(".preview-dot");
        dots.forEach(d => d.classList.remove("active"));

        let activeDotIndex = 0;
        if (index === 0) activeDotIndex = 0;
        else if (index === 1) activeDotIndex = 1;
        else if (index >= totalItems - 1) activeDotIndex = 3;
        else activeDotIndex = 2;

        if (dots[activeDotIndex]) {
            dots[activeDotIndex].classList.add("active");
        }
    }

    function renderLocalRelatedImages(currentIndex, allItems) {
        const relatedGrid = preview.querySelector(".related-grid");
        if (!relatedGrid) return;

        relatedGrid.innerHTML = "";
        const nextItems = allItems.slice(currentIndex + 1, currentIndex + 11);

        if (nextItems.length === 0) {
            relatedGrid.innerHTML = `<div class="related-empty">Tidak ada gambar berikutnya.</div>`;
            return;
        }

        nextItems.forEach((itemEl) => {
            const data = extractDataFromElement(itemEl);
            const itemIndex = allItems.indexOf(itemEl);

            const card = document.createElement("div");
            card.className = "related-card";
            card.innerHTML = `
                <div class="related-card__thumb">
                    <img src="${data.imgSrc}" loading="lazy" alt="${data.titleText}">
                </div>
                <div class="related-card__title">${data.titleText}</div>
            `;

            card.addEventListener("click", () => {
                showPreviewByIndex(itemIndex);
            });

            relatedGrid.appendChild(card);
        });
    }

    // Touch Swipe Drag dengan Animasi Geser Nyata
    const thumbWrapper = preview.querySelector(".image-preview__thumbnail");

    thumbWrapper.addEventListener("touchstart", (e) => {
        touchStartX = e.touches[0].clientX;
        touchMoveX = touchStartX;
        isSwiping = true;
        track.style.transition = "none";
    }, { passive: true });

    thumbWrapper.addEventListener("touchmove", (e) => {
        if (!isSwiping) return;
        touchMoveX = e.touches[0].clientX;
        const diffX = touchMoveX - touchStartX;
        
        // Geser track secara eksplisit saat jari diseret
        const containerWidth = thumbWrapper.clientWidth;
        const currentOffsetPercent = -100 + (diffX / containerWidth) * 100;
        track.style.transform = `translateX(${currentOffsetPercent}%)`;
    }, { passive: true });

    thumbWrapper.addEventListener("touchend", () => {
        if (!isSwiping) return;
        isSwiping = false;

        const diffX = touchMoveX - touchStartX;
        const threshold = 50; // Jarak minimum geser

        if (diffX < -threshold) {
            // Swipe ke Kiri -> Gambar Selanjutnya
            track.style.transition = "transform 0.25s ease-out";
            track.style.transform = "translateX(-200%)";
            setTimeout(() => {
                showPreviewByIndex(currentImageIndex + 1, 1);
            }, 200);
        } else if (diffX > threshold) {
            // Swipe ke Kanan -> Gambar Sebelumnya
            track.style.transition = "transform 0.25s ease-out";
            track.style.transform = "translateX(0%)";
            setTimeout(() => {
                showPreviewByIndex(currentImageIndex - 1, -1);
            }, 200);
        } else {
            // Kembali ke Posisi Semula jika seretan tidak cukup jauh
            track.style.transition = "transform 0.2s ease-out";
            track.style.transform = "translateX(-100%)";
        }
    }, { passive: true });
}

