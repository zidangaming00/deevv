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
const gap = 2; 

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
    const uniformGap = 8;

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
                            ${faviconSrc ? `<img src="${faviconSrc}" style="width:14px;height:14px;margin-right:4px;">` : ''} 
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
// MOBILE PREVIEW OVERLAY
// ==========================================
function isMobile() { 
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent); 
} 

if (isMobile() && document.querySelector(".cbKRN")) { 
    document.querySelector(".cbKRN").insertAdjacentHTML("beforeend", ` 
        <div class="image-preview"> 
            <div class="image-preview__header"> 
                <div class="left"> 
                    <div class="image-preview__favicon"><img src=""></div> 
                    <div class="title"></div> 
                </div> 
                <div class="right"> 
                    <div class="image-preview__favicon close-preview"> 
                        <svg viewBox="0 0 24 24" focusable="false" height="24" width="24"> 
                            <path d="M0 0h24v24H0z" fill="none"></path> 
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path> 
                        </svg> 
                    </div> 
                </div> 
            </div> 
            <div class="image-preview__thumbnail"><img src="" alt="Preview"></div> 
            <div class="image-preview__footer"> 
                <div class="left"> 
                    <div class="title"></div> 
                    <div class="site"></div> 
                </div> 
                <div class="right"> 
                    <button><a href="" target="_blank" rel="noopener">Kunjungi</a></button> 
                </div> 
            </div> 
        </div> 
    `); 
    
    const preview = document.querySelector(".image-preview"); 
    if (preview) preview.style.display = "none"; 
    
    function hidePreview() { 
        if (preview) preview.style.display = "none"; 
        document.documentElement.style.overflow = "auto"; 
    } 
    
    const closeBtn = document.querySelector(".close-preview");
    if (closeBtn) closeBtn.addEventListener("click", hidePreview); 
    
    document.body.addEventListener("click", (event) => { 
        const img = event.target.closest(".image-item__thumb img"); 
        if (!img) return; 
        event.preventDefault(); 
        showPreview(img); 
    }); 
    
    function showPreview(img) { 
        if (!preview) return; 
        preview.style.display = "block"; 
        document.documentElement.style.overflow = "hidden"; 
        const parent = img.closest(".image-item"); 
        if (parent) { 
            const titleElement = parent.querySelector(".image-item__info .title"); 
            const descElement = parent.querySelector(".image-item__desc span"); 
            const infoLinkElement = parent.querySelector(".image-item__info"); 
            const descImgElement = parent.querySelector(".image-item__desc img"); 
            
            if (titleElement) preview.querySelector(".image-preview__footer .left .title").innerText = titleElement.innerText; 
            if (descElement) { 
                preview.querySelector(".image-preview__footer .left .site").innerText = "Gambar mungkin memiliki hak cipta."; 
                preview.querySelector(".image-preview__header .title").innerText = descElement.innerText; 
            } 
            if (infoLinkElement) preview.querySelector(".image-preview__footer .right a").href = infoLinkElement.href; 
            if (descImgElement) preview.querySelector(".image-preview__favicon img").src = descImgElement.src; 
            
            preview.querySelector(".image-preview__thumbnail img").src = img.src; 
            preview.querySelector(".image-preview__thumbnail img").alt = img.alt; 
        } 
    } 
}
