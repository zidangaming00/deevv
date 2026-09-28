// ==========================================
// CONFIGURATION & API ENDPOINTS
// ==========================================
const searchQuery = urlParams.get("q") || "";

// API Baru (Default)
const NEW_API_URL = "https://deevv-api-production.up.railway.app/api/search";

// API Lama (Dipertahankan sebagai variabel)
const OLD_API_URL = "https://images.searchdata.workers.dev/dimage";

// State & Layout Controls
const container = document.querySelector(".main-result"); 
const shwrapper = document.querySelector(".show-wrapper"); 
const minWidth = 150; 
const maxColumns = 6; 
const gap = 1; 

let start = 1; 
let isLoading = false; 
let lastFetchHeight = 0; 

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
// LAYOUT ENGINE (POSISI INSTAN)
// ==========================================
function positionItems() { 
    if (!container) return;
    const items = Array.from(container.querySelectorAll(".image-item")); 
    if (items.length === 0) return; 

    const containerWidth = container.clientWidth; 
    let cols = Math.floor(containerWidth / (minWidth + gap)); 
    cols = Math.max(1, Math.min(maxColumns, cols)); 
    
    let itemWidth = Math.floor((containerWidth - (cols - 1) * gap) / cols); 
    let columnHeights = new Array(cols).fill(0); 

    items.forEach((item) => { 
        let imgThumb = item.querySelector(".image-item__thumb"); 
        item.style.width = `${itemWidth}px`; 
        
        if (imgThumb) {
            imgThumb.style.width = `${itemWidth - 8}px`; 
            
            const ratio = parseFloat(item.dataset.aspectRatio) || 1.33;
            const computedThumbHeight = Math.floor((itemWidth - 8) / ratio);
            imgThumb.style.height = `${computedThumbHeight}px`;
        } 

        let colIndex = columnHeights.indexOf(Math.min(...columnHeights)); 
        let topPos = columnHeights[colIndex]; 
        let leftPos = colIndex * (itemWidth + gap); 

        item.style.position = "absolute"; 
        item.style.left = `${leftPos}px`; 
        item.style.top = `${topPos}px`; 

        let itemHeight = item.getBoundingClientRect().height + gap; 
        columnHeights[colIndex] += itemHeight; 
    }); 

    container.style.height = `${Math.max(...columnHeights) + 80}px`; 
} 

window.addEventListener("resize", positionItems); 

// ==========================================
// DATA FETCHING (DENGAN ALERT DEBUG)
// ==========================================
function fetchData() { 
    if (isLoading || !searchQuery) {
        if (!searchQuery) alert("Query pencarian kosong!");
        return; 
    }
    isLoading = true; 
    
    // Request ke API Baru
    const fetchUrl = `${NEW_API_URL}?q=${encodeURIComponent(searchQuery)}&type=images&page=${start}`;
    
    fetch(fetchUrl)
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP Error Status: ${response.status}`);
        }
        return response.json();
    })
    .then(response => { 
        // Debug Alert untuk HP
        console.log("Response API Baru:", response); 
        
        // Cek struktur array dari response
        let imageList = [];
        if (Array.isArray(response)) {
            imageList = response;
        } else if (response.results && Array.isArray(response.results)) {
            imageList = response.results;
        } else if (response.images && Array.isArray(response.images)) {
            imageList = response.images;
        } else if (response.data && Array.isArray(response.data)) {
            imageList = response.data;
        }

        if (imageList.length === 0) {
            alert("API berhasil dipanggil tapi data gambar kosong!\nIsi response: " + JSON.stringify(response).slice(0, 150));
            clearLoader();
            isLoading = false;
            return;
        }

        renderResults(imageList); 
        start += 1; 
        lastFetchHeight = document.body.scrollHeight; 
        clearLoader();
    })
    .catch(error => { 
        isLoading = false; 
        clearLoader();
        alert("Gagal Fetch API!\nError: " + error.message); 
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
        
        // Parsing properti dari API
        const thumbSrc = item.thumbnail || item.thumbnailUrl || item.image || item.url || item.src || "";
        const fullSrc = item.image || item.originalUrl || item.url || thumbSrc;
        const pageUrl = item.pageUrl || item.contextLink || item.link || "#";
        const titleText = item.title || item.snippet || "Image";

        // Dimensi gambar untuk aspek rasio
        const imgWidth = item.width || item.imageWidth || 300;
        const imgHeight = item.height || item.imageHeight || 225;
        const aspectRatio = (imgWidth / imgHeight).toFixed(2);

        imgElement.src = thumbSrc; 
        imgElement.loading = "lazy"; 
        imgElement.alt = titleText; 
        
        let imgContainer = document.createElement("div"); 
        imgContainer.classList.add("image-item"); 
        imgContainer.setAttribute("tabindex", `tab-${i}`); 
        imgContainer.dataset.aspectRatio = aspectRatio; 
        
        let hostname = "";
        if (pageUrl && pageUrl !== "#") {
            try {
                hostname = new URL(pageUrl).hostname;
            } catch (e) {
                hostname = "";
            }
        }
        
        const faviconSrc = hostname ? `https://datasearch.searchdata.workers.dev/img/${encodeURIComponent(hostname)}` : '';
        const siteName = item.siteName || item.source || hostname || "Web";

        imgContainer.innerHTML = ` 
            <div class="image-item__box"> 
                <div class="image-item__dt"> 
                    <div class="image-item__thumb"></div> 
                    <a class="image-item__info" href="${pageUrl}" target="_blank" rel="noopener"> 
                        <p class="title" name="t">${titleText}</p> 
                        <p class="image-item__desc"> 
                            ${faviconSrc ? `<img src="${faviconSrc}">` : ''} 
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
    imgElement.style.transition = "filter .5s ease-in-out"; 
    
    if (fullSrc && fullSrc !== thumbnailSrc) {
        const fullImage = new Image(); 
        fullImage.src = fullSrc; 
        fullImage.onload = function() { 
            imgElement.src = fullSrc; 
            imgElement.style.filter = "blur(0)"; 
        }; 
    }
    
    setTimeout(() => { 
        imgElement.style.filter = "blur(0)"; 
        imgElement.removeAttribute("style"); 
    }, 5000); 
} 

// ==========================================
// INFINITE SCROLL (MAKSIMAL 2 KALI SCROLL)
// ==========================================
window.addEventListener("scroll", function() { 
    if (isLoading || scrollCount >= maxScrolls) return; 

    const scrollThreshold = 200; 
    const hasScrolledPastLastFetch = window.scrollY > lastFetchHeight - scrollThreshold; 
    
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100 && hasScrolledPastLastFetch) { 
        scrollCount++; 
        
        if (shwrapper) {
            shwrapper.innerHTML = `<div class="loader"><svg class="circular" viewBox="25 25 50 50"><circle class="path" cx="50" cy="50" r="20" fill="none" stroke-width="4" stroke-miterlimit="10"/></svg></div>`; 
            shwrapper.style.position = 'static';
        }
        setTimeout(fetchData, 1000); 
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
