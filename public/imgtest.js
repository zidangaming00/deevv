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

// Helper hapus loader
let isWaiting = false; // jeda sebelum fetch

function showLoader() {
    if (!shwrapper) return;

    shwrapper.innerHTML = `
        <div class="loader">
            <svg class="circular" viewBox="25 25 50 50">
                <circle
                    class="path"
                    cx="50"
                    cy="50"
                    r="20"
                    fill="none"
                    stroke-width="4"
                    stroke-miterlimit="10"
                />
            </svg>
        </div>
    `;
    
    // Gunakan posisi relatif/block biasa di bawah kontainer hasil
    // agar tidak menimpa gambar
    shwrapper.style.position = 'relative';
    shwrapper.style.width = '100%';
    shwrapper.style.display = 'flex';
    shwrapper.style.justifyContent = 'center';
    shwrapper.style.alignItems = 'center';
    shwrapper.style.height = '80px';
    shwrapper.style.marginTop = '16px';
    shwrapper.style.clear = 'both';
}

function clearLoader() {
    if (shwrapper) {
        shwrapper.innerHTML = '';
        shwrapper.style.height = '0px';
        shwrapper.style.marginTop = '0px';
        shwrapper.style.display = 'none';
    }

    positionItems();

    if (typeof UI !== 'undefined' && UI.renderFooter) {
        UI.renderFooter();
    }
}

// ==========================================
// LAYOUT ENGINE (PERFECT EQUAL GAPS)
// ==========================================
function positionItems() { 
    if (!container) return;

    const items = Array.from(
        container.querySelectorAll(".image-item")
    ); 

    if (items.length === 0) return; 

    const containerWidth =
        container.getBoundingClientRect().width;

    const uniformGap = 6;

    let cols = Math.floor(
        containerWidth / (minWidth + uniformGap)
    );

    cols = Math.max(
        1,
        Math.min(maxColumns, cols)
    ); 

    // Total ruang gap:
    // kiri + tengah + kanan
    const totalGapSpace =
        (cols + 1) * uniformGap;

    // Lebar total yang tersisa untuk semua gambar
    const availableForItems =
        containerWidth - totalGapSpace;

    // Lebar dasar tiap kolom
    const baseWidth =
        Math.floor(availableForItems / cols);

    // Sisa piksel akibat pembulatan
    const leftoverPixels =
        availableForItems - baseWidth * cols;

    // Array lebar tiap kolom
    const columnWidths =
        new Array(cols).fill(baseWidth);

    for (let i = 0; i < leftoverPixels; i++) {
        columnWidths[i] += 1;
    }

    // Hitung posisi X kiri tiap kolom
    const columnLeftPositions =
        new Array(cols);

    let cursor = uniformGap;

    for (let i = 0; i < cols; i++) {
        columnLeftPositions[i] = cursor;
        cursor +=
            columnWidths[i] +
            uniformGap;
    }

    let columnHeights =
        new Array(cols).fill(0); 

    items.forEach((item) => { 
        let colIndex =
            columnHeights.indexOf(
                Math.min(...columnHeights)
            ); 

        let itemWidth =
            columnWidths[colIndex];

        let imgThumb =
            item.querySelector(
                ".image-item__thumb"
            ); 
        
        item.style.width =
            `${itemWidth}px`; 
        
        if (imgThumb) {
            const ratio =
                parseFloat(
                    item.dataset.aspectRatio
                ) || 1.33;

            imgThumb.style.height =
                `${Math.floor(itemWidth / ratio)}px`;
        } 

        let topPos =
            columnHeights[colIndex];

        let leftPos =
            columnLeftPositions[colIndex];

        item.style.position =
            "absolute"; 

        item.style.left =
            `${leftPos}px`; 

        item.style.top =
            `${topPos}px`; 

        columnHeights[colIndex] +=
            item.offsetHeight +
            uniformGap; 
    }); 

    container.style.height =
        `${Math.max(...columnHeights) + 8}px`;
}

window.addEventListener(
    "resize",
    positionItems
); 

// ==========================================
// DATA FETCHING
// ==========================================
function fetchData(retryCount = 0) { 
    if (isLoading || !searchQuery) return; 

    isLoading = true; 
    
    const fetchUrl =
        `${NEW_API_URL}?q=${encodeURIComponent(searchQuery)}&type=images&start=${startOffset}&num=20`;
    
    fetch(fetchUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(
                    `HTTP Status ${response.status}`
                );
            }

            return response.json();
        })
        .then(response => { 
            let imageList = [];

            if (Array.isArray(response)) {
                imageList = response;
            } else if (
                response.results &&
                Array.isArray(response.results)
            ) {
                imageList = response.results;
            } else if (
                response.images &&
                Array.isArray(response.images)
            ) {
                imageList = response.images;
            }

            if (imageList.length === 0) {
                clearLoader();
                isLoading = false;
                return;
            }

            renderResults(imageList); 

            startOffset +=
                imageList.length;

            clearLoader();
        })
        .catch(error => { 
            isLoading = false; 

            // Auto-retry silent jika Railway cold-start
            if (retryCount < 2) {
                setTimeout(() => {
                    fetchData(
                        retryCount + 1
                    );
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
    if (
        !images ||
        !Array.isArray(images) ||
        images.length === 0
    ) {
        isLoading = false;
        return;
    }

    let fragment =
        document.createDocumentFragment(); 

    images.forEach((item, i) => {
        let imgElement =
            document.createElement("img"); 
        
        const thumbSrc =
            item.thumbnail ||
            item.thumbnailUrl ||
            item.image ||
            item.imageUrl ||
            "";

        const fullSrc =
            item.image ||
            item.imageUrl ||
            thumbSrc;

        const pageUrl =
            item.pageUrl ||
            item.link ||
            "#";

        const titleText =
            item.title ||
            "Image";

        const imgWidth =
            item.width ||
            item.imageWidth ||
            0;

        const imgHeight =
            item.height ||
            item.imageHeight ||
            0;
        
        let aspectRatio = 1.33;

        if (
            imgWidth > 0 &&
            imgHeight > 0
        ) {
            aspectRatio =
                (
                    imgWidth /
                    imgHeight
                ).toFixed(2);
        }

        imgElement.src =
            thumbSrc; 

        imgElement.loading =
            "lazy"; 

        imgElement.alt =
            titleText; 

        imgElement.style.width =
            "100%";

        imgElement.style.height =
            "100%";

        imgElement.style.objectFit =
            "cover";
        
        let imgContainer =
            document.createElement("div"); 

        imgContainer.classList.add(
            "image-item"
        ); 

        imgContainer.dataset.aspectRatio =
            aspectRatio; 
        
        let hostname = "";

        if (
            pageUrl &&
            pageUrl !== "#"
        ) {
            try {
                hostname =
                    new URL(pageUrl)
                        .hostname
                        .replace(/^www\./, '');
            } catch (e) {}
        }
        
        const faviconSrc =
            hostname
                ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
                : '';

        const siteName =
            item.source ||
            item.domain ||
            hostname ||
            "Web";

        imgContainer.innerHTML = ` 
            <div class="image-item__box"> 
                <div class="image-item__dt"> 
                    <div class="image-item__thumb"></div> 

                    <a
                        class="image-item__info"
                        href="${pageUrl}"
                        target="_blank"
                        rel="noopener"
                    > 
                        <p
                            class="title"
                            name="t"
                        >${titleText}</p> 

                        <p class="image-item__desc"> 
                            <span>${siteName}</span> 
                        </p> 
                    </a> 
                </div> 
            </div>
        `;

        loadImage(
            imgElement,
            thumbSrc,
            fullSrc
        ); 

        imgContainer
            .querySelector(
                ".image-item__thumb"
            )
            .appendChild(imgElement); 
        
        imgElement.onerror =
            function() { 
                let parent =
                    imgElement.closest(
                        ".image-item"
                    ); 

                if (parent) {
                    parent.remove();
                }

                positionItems(); 
            }; 
        
        fragment.appendChild(
            imgContainer
        ); 
    }); 

    if (
        shwrapper &&
        shwrapper.parentNode === container
    ) {
        container.insertBefore(
            fragment,
            shwrapper
        ); 
    } else if (container) {
        container.appendChild(
            fragment
        );
    }

    isLoading = false; 

    positionItems(); 
} 

function loadImage(
    imgElement,
    thumbnailSrc,
    fullSrc
) { 
    imgElement.src =
        thumbnailSrc; 

    imgElement.style.filter =
        "blur(2px)"; 

    imgElement.style.transition =
        "filter .3s ease-in-out"; 
    
    if (
        fullSrc &&
        fullSrc !== thumbnailSrc
    ) {
        const fullImage =
            new Image(); 

        fullImage.src =
            fullSrc; 

        fullImage.onload =
            function() { 
                imgElement.src =
                    fullSrc; 

                imgElement.style.filter =
                    "blur(0)"; 
            };

        fullImage.onerror =
            function() {
                imgElement.style.filter =
                    "blur(0)";
            };
    } else {
        imgElement.style.filter =
            "blur(0)";
    }
} 

// ==========================================
// INFINITE SCROLL (BATAS SCROLL MAX 2X)
// ==========================================
window.addEventListener(
    "scroll",
    function () {
        if (
            isLoading ||
            isWaiting ||
            scrollCount >= maxScrolls
        ) {
            return;
        }

        if (
            (
                window.innerHeight +
                window.scrollY
            ) >=
            document.body.offsetHeight - 200
        ) {
            scrollCount++;
            isWaiting = true;

            showLoader();

            // Jeda dulu biar loader kelihatan,
            // baru fetch
            setTimeout(() => {
                isWaiting = false;
                fetchData();
            }, 700);
        }
    }
);

// Eksekusi Pemuatan Pertama
fetchData();

// ==========================================
// MOBILE PREVIEW OVERLAY + RELATED IMAGES
// ==========================================
function isMobile() { 
    return /Mobi|Android|iPhone|iPad|iPod/i.test(
        navigator.userAgent
    ); 
} 

// ==========================================
// MOBILE PREVIEW OVERLAY
// FULL CARD SLIDE ALA GOOGLE IMAGES
// ==========================================
const targetContainer =
    document.querySelector(".cbKRN") ||
    document.body;

if (
    targetContainer &&
    !document.querySelector(".image-preview")
) { 
    targetContainer.insertAdjacentHTML(
        "beforeend",
        ` 
        <div
            class="image-preview"
            style="display:none;"
        > 
            <div class="preview-card-track">

                <div
                    class="preview-card-page prev-page"
                ></div>

                <div
                    class="preview-card-page current-page"
                ></div>

                <div
                    class="preview-card-page next-page"
                ></div>

            </div>

            <div class="preview-dots">

                <div class="preview-dot active"></div>
                <div class="preview-dot"></div>
                <div class="preview-dot"></div>
                <div class="preview-dot"></div>

            </div>
        </div> 
    `); 

    const preview =
        document.querySelector(
            ".image-preview"
        ); 

    const track =
        preview.querySelector(
            ".preview-card-track"
        );

    const prevPage =
        preview.querySelector(
            ".prev-page"
        );

    const currPage =
        preview.querySelector(
            ".current-page"
        );

    const nextPage =
        preview.querySelector(
            ".next-page"
        );

    let currentImageIndex = -1;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoveX = 0;
    let touchMoveY = 0;

    let isHorizontalSwipe = false;
    let isTouchActive = false;

    // ==========================================
    // TEMPLATE GENERATOR UNTUK 1 KARTU
    // ==========================================
    function createCardHTML(data) {
        if (!data) {
            return `<div style="height:100vh;"></div>`;
        }

        const hostname =
            data.pageUrl &&
            data.pageUrl !== "#"
                ? new URL(
                    data.pageUrl
                ).hostname
                : "";

        const faviconSrc =
            hostname
                ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
                : "";

        return `
            <div class="image-preview__header"> 

                <div class="left"> 
                    <div class="image-preview__favicon">
                        <img
                            src="${faviconSrc}"
                            alt="Fav"
                        >
                    </div> 

                    <div class="title header-site-name">
                        ${data.siteName}
                    </div>
                </div> 

                <div class="right"> 
                    <div
                        class="image-preview__favicon close-preview"
                        style="cursor:pointer;"
                    > 
                        <svg
                            viewBox="0 0 24 24"
                            height="24"
                            width="24"
                        >
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
                        </svg> 
                    </div> 
                </div> 

            </div> 

            <div class="image-preview__thumbnail">
                <img
                    src="${data.imgSrc}"
                    alt="${data.titleText}"
                >
            </div> 

            <div class="image-preview__footer"> 

                <div class="left"> 
                    <div class="title footer-image-title">
                        ${data.titleText}
                    </div>

                    <div class="site">
                        Gambar mungkin memiliki hak cipta.
                    </div> 
                </div> 

                <div class="right"> 
                    <button>
                        <a
                            href="${data.pageUrl}"
                            target="_blank"
                            rel="noopener"
                        >
                            Kunjungi
                        </a>
                    </button> 
                </div> 

            </div> 

            <div class="image-preview__actions">

                <button
                    class="action-btn share-btn"
                    data-url="${data.pageUrl}"
                    data-title="${data.titleText}"
                >
                    <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                    >
                        <path
                            fill="currentColor"
                            d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"
                        />
                    </svg>

                    <span>Bagikan</span>
                </button>

                <button
                    class="action-btn download-btn"
                    data-img="${data.imgSrc}"
                    data-title="${data.titleText}"
                >
                    <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                    >
                        <path
                            fill="currentColor"
                            d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"
                        />
                    </svg>

                    <span>Unduh</span>
                </button>

            </div>

            <div class="image-preview__related">
                <div class="related-title">
                    Gambar Berikutnya
                </div>

                <div class="related-grid"></div>
            </div>
        `;
    }

    // ==========================================
    // EVENT LISTENER CLOSE, BAGIKAN & UNDUH
    // ==========================================
    preview.addEventListener(
        "click",
        (e) => {

            // CLOSE
            if (
                e.target.closest(
                    ".close-preview"
                )
            ) {
                preview.style.display =
                    "none";

                document.documentElement.style.overflow =
                    "auto";

                return;
            }

            // ======================================
            // SHARE
            // ======================================
            const shareBtn =
                e.target.closest(
                    ".share-btn"
                );

            if (shareBtn) {
                const url =
                    shareBtn.dataset.url;

                const title =
                    shareBtn.dataset.title;

                if (navigator.share) {
                    navigator.share({
                        title: title,
                        url: url
                    }).catch(() => {});
                } else if (
                    navigator.clipboard
                ) {
                    navigator.clipboard.writeText(
                        url
                    );

                    alert(
                        "Tautan berhasil disalin!"
                    );
                }

                return;
            }

            // ======================================
            // DOWNLOAD
            // ======================================
            const downloadBtn =
                e.target.closest(
                    ".download-btn"
                );

            if (downloadBtn) {
                const imgSrc =
                    downloadBtn.dataset.img;

                const title =
                    downloadBtn.dataset.title ||
                    "image";

                const fileName =
                    title
                        .replace(
                            /[^a-z0-9]/gi,
                            '_'
                        )
                        .toLowerCase() +
                    ".jpg";

                if (imgSrc) {
                    fetch(imgSrc)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(
                                    "Gagal mengunduh gambar."
                                );
                            }

                            return response.blob();
                        })
                        .then(blob => {

                            const blobUrl =
                                URL.createObjectURL(
                                    blob
                                );

                            const a =
                                document.createElement(
                                    "a"
                                );

                            a.href =
                                blobUrl;

                            a.download =
                                fileName;

                            document.body.appendChild(
                                a
                            );

                            a.click();

                            document.body.removeChild(
                                a
                            );

                            URL.revokeObjectURL(
                                blobUrl
                            );
                        })
                        .catch(() => {

                            // Fallback jika server
                            // gambar memblokir CORS
                            const a =
                                document.createElement(
                                    "a"
                                );

                            a.href =
                                imgSrc;

                            a.target =
                                "_blank";

                            a.download =
                                fileName;

                            a.click();
                        });
                }

                return;
            }
        }
    );

    // ==========================================
    // DELEGASI KLIK GAMBAR UTAMA DI GRID
    // ==========================================
    document.body.addEventListener(
        "click",
        (event) => {

            const img =
                event.target.closest(
                    ".image-item__thumb img"
                );

            if (!img) return;

            event.preventDefault();

            const parent =
                img.closest(
                    ".image-item"
                );

            if (!parent) return;

            const allItems =
                Array.from(
                    document.querySelectorAll(
                        ".main-result .image-item"
                    )
                );

            const index =
                allItems.indexOf(
                    parent
                );

            showPreviewByIndex(index);
        }
    );

    // ==========================================
    // EXTRACT DATA
    // ==========================================
    function extractDataFromElement(
        itemEl
    ) {
        if (!itemEl) return null;

        const img =
            itemEl.querySelector(
                ".image-item__thumb img"
            );

        return {
            titleText:
                itemEl.querySelector(
                    ".image-item__info .title"
                )?.innerText || "",

            siteName:
                itemEl.querySelector(
                    ".image-item__desc span"
                )?.innerText || "",

            pageUrl:
                itemEl.querySelector(
                    ".image-item__info"
                )?.href || "#",

            imgSrc:
                img
                    ? img.src
                    : ""
        };
    }

    // Cache elemen agar tidak query DOM
    // berulang kali ketika touchmove
    let cachedAllItems = [];

    // ==========================================
    // SHOW PREVIEW
    // ==========================================
    function showPreviewByIndex(index) {

        cachedAllItems =
            Array.from(
                document.querySelectorAll(
                    ".main-result .image-item"
                )
            );

        if (
            index < 0 ||
            index >= cachedAllItems.length
        ) {
            return;
        }

        currentImageIndex =
            index;

        preview.style.display =
            "block";

        // Mobile: kunci scroll halaman utama
        if (
            window.innerWidth < 1024
        ) {
            document.documentElement.style.overflow =
                "hidden";
        }

        const prevData =
            extractDataFromElement(
                cachedAllItems[index - 1]
            );

        const currData =
            extractDataFromElement(
                cachedAllItems[index]
            );

        const nextData =
            extractDataFromElement(
                cachedAllItems[index + 1]
            );

        // Tetap buat 3 halaman agar sistem
        // slide existing tetap bekerja
        prevPage.innerHTML =
            createCardHTML(
                prevData
            );

        currPage.innerHTML =
            createCardHTML(
                currData
            );

        nextPage.innerHTML =
            createCardHTML(
                nextData
            );

        // ======================================
        // OPTIMASI BESAR:
        // Related hanya dibuat untuk halaman
        // yang sedang aktif.
        //
        // Sebelumnya:
        // 3 halaman x 10 related image
        //
        // Sekarang:
        // 1 halaman x 10 related image
        // ======================================
        renderLocalRelatedImages(
            index,
            cachedAllItems,
            currPage
        );

        prevPage.dataset.relatedIndex =
            index - 1;

        currPage.dataset.relatedIndex =
            index;

        nextPage.dataset.relatedIndex =
            index + 1;

        prevPage.dataset.relatedRendered =
            "false";

        currPage.dataset.relatedRendered =
            "true";

        nextPage.dataset.relatedRendered =
            "false";

        // Reset posisi track
        track.style.transition =
            "none";

        track.style.transform =
            "translate3d(-100%, 0, 0)";

        currPage.scrollTop =
            0;

        updateDots(
            index,
            cachedAllItems.length
        );
    }

    // ==========================================
    // DOT INDEX
    // ==========================================
    function getDotIndex(
        idx,
        totalItems
    ) {
        if (idx <= 0) return 0;

        if (idx === 1) return 1;

        if (
            idx >=
            totalItems - 1
        ) {
            return 3;
        }

        return 2;
    }

    // ==========================================
    // DOT REALTIME SAAT SWIPE
    // ==========================================
    function updateDotsRealtime(
        diffX,
        containerWidth,
        currentIndex,
        totalItems
    ) {
        const dots =
            preview.querySelectorAll(
                ".preview-dot"
            );

        if (!dots.length) return;

        const direction =
            diffX < 0
                ? 1
                : -1;

        const targetIndex =
            currentIndex +
            direction;

        const progress =
            Math.min(
                Math.abs(diffX) /
                    containerWidth,
                1
            );

        const fromDotIdx =
            getDotIndex(
                currentIndex,
                totalItems
            );

        const toDotIdx =
            getDotIndex(
                targetIndex,
                totalItems
            );

        dots.forEach(
            (dot, idx) => {

                if (
                    fromDotIdx ===
                    toDotIdx
                ) {

                    if (
                        idx ===
                        fromDotIdx
                    ) {
                        dot.style.width =
                            "16px";

                        dot.style.backgroundColor =
                            "rgba(255, 255, 255, 1)";
                    } else {
                        dot.style.width =
                            "6px";

                        dot.style.backgroundColor =
                            "rgba(255, 255, 255, 0.4)";
                    }

                } else {

                    if (
                        idx ===
                        fromDotIdx
                    ) {
                        const w =
                            16 -
                            (10 * progress);

                        const op =
                            1 -
                            (0.6 * progress);

                        dot.style.width =
                            `${w}px`;

                        dot.style.backgroundColor =
                            `rgba(255, 255, 255, ${op})`;

                    } else if (
                        idx ===
                        toDotIdx
                    ) {

                        const w =
                            6 +
                            (10 * progress);

                        const op =
                            0.4 +
                            (0.6 * progress);

                        dot.style.width =
                            `${w}px`;

                        dot.style.backgroundColor =
                            `rgba(255, 255, 255, ${op})`;

                    } else {

                        dot.style.width =
                            "6px";

                        dot.style.backgroundColor =
                            "rgba(255, 255, 255, 0.4)";
                    }
                }
            }
        );
    }

    // ==========================================
    // UPDATE DOT NORMAL
    // ==========================================
    function updateDots(
        index,
        totalItems
    ) {
        const dots =
            preview.querySelectorAll(
                ".preview-dot"
            );

        const activeDotIndex =
            getDotIndex(
                index,
                totalItems
            );

        dots.forEach(
            (d, i) => {

                d.style.transition =
                    "";

                d.style.width =
                    "";

                d.style.backgroundColor =
                    "";

                d.classList.toggle(
                    "active",
                    i ===
                        activeDotIndex
                );
            }
        );
    }

    // ==========================================
    // RELATED IMAGES
    // ==========================================
    function renderLocalRelatedImages(
        currentIndex,
        allItems,
        pageElem
    ) {
        if (
            currentIndex < 0 ||
            !pageElem
        ) {
            return;
        }

        const relatedGrid =
            pageElem.querySelector(
                ".related-grid"
            );

        if (!relatedGrid) return;

        relatedGrid.innerHTML =
            "";

        const nextItems =
            allItems.slice(
                currentIndex + 1,
                currentIndex + 11
            );

        if (
            nextItems.length === 0
        ) {
            relatedGrid.innerHTML =
                `
                <div class="related-empty">
                    Tidak ada gambar berikutnya.
                </div>
            `;

            return;
        }

        nextItems.forEach(
            (itemEl) => {

                const data =
                    extractDataFromElement(
                        itemEl
                    );

                const itemIndex =
                    allItems.indexOf(
                        itemEl
                    );

                const ratio =
                    parseFloat(
                        itemEl.dataset.aspectRatio
                    ) || 1.33;

                const card =
                    document.createElement(
                        "div"
                    );

                card.className =
                    "related-card";

                card.innerHTML = `
                    <div class="related-card__thumb">
                        <img
                            src="${data.imgSrc}"
                            loading="lazy"
                            alt="${data.titleText}"
                        >
                    </div>

                    <div class="related-card__title">
                        ${data.titleText}
                    </div>
                `;

                card.addEventListener(
                    "click",
                    () => {
                        showPreviewByIndex(
                            itemIndex
                        );
                    }
                );

                relatedGrid.appendChild(
                    card
                );
            }
        );
    }

    // ==========================================
    // TOUCH HANDLING
    // ==========================================
    preview.addEventListener(
        "touchstart",
        (e) => {

            touchStartX =
                e.touches[0].clientX;

            touchStartY =
                e.touches[0].clientY;

            touchMoveX =
                touchStartX;

            touchMoveY =
                touchStartY;

            isHorizontalSwipe =
                false;

            isTouchActive =
                true;

            // Hanya aktif saat benar-benar swipe
            // supaya GPU tidak terus dipaksa
            preview.classList.add(
                "is-swiping"
            );

            track.style.transition =
                "none";
        },
        {
            passive: true
        }
    );

    let ticking = false;

    // ==========================================
    // TOUCH MOVE
    // ==========================================
    preview.addEventListener(
        "touchmove",
        (e) => {

            if (!isTouchActive) {
                return;
            }

            touchMoveX =
                e.touches[0].clientX;

            touchMoveY =
                e.touches[0].clientY;

            const diffX =
                touchMoveX -
                touchStartX;

            const diffY =
                touchMoveY -
                touchStartY;

            // Tentukan apakah gesture horizontal
            // atau vertical
            if (!isHorizontalSwipe) {

                const isHorizontalIntent =
                    Math.abs(diffX) >
                        Math.abs(diffY) &&
                    Math.abs(diffX) >
                        8;

                if (
                    isHorizontalIntent
                ) {
                    isHorizontalSwipe =
                        true;
                } else {
                    // Vertical scroll tetap normal
                    return;
                }
            }

            if (
                isHorizontalSwipe
            ) {

                // Kunci vertical scrolling
                // hanya ketika gesture memang horizontal
                if (e.cancelable) {
                    e.preventDefault();
                }

                // Batasi update transform
                // maksimal sekali per frame
                if (!ticking) {

                    window.requestAnimationFrame(
                        () => {

                            let moveDiffX =
                                diffX;

                            const containerWidth =
                                preview.clientWidth;

                            const totalLen =
                                cachedAllItems.length ||
                                1;

                            // Resistance di ujung
                            if (
                                (
                                    currentImageIndex === 0 &&
                                    moveDiffX > 0
                                ) ||
                                (
                                    currentImageIndex ===
                                        totalLen - 1 &&
                                    moveDiffX < 0
                                )
                            ) {
                                moveDiffX *=
                                    0.2;
                            }

                            const currentOffsetPercent =
                                -100 +
                                (
                                    moveDiffX /
                                    containerWidth
                                ) *
                                    100;

                            track.style.transform =
                                `translate3d(${currentOffsetPercent}%, 0, 0)`;

                            updateDotsRealtime(
                                moveDiffX,
                                containerWidth,
                                currentImageIndex,
                                totalLen
                            );

                            ticking =
                                false;
                        }
                    );

                    ticking =
                        true;
                }
            }
        },
        {
            passive: false
        }
    );

    // ==========================================
    // TOUCH END
    // ==========================================
    preview.addEventListener(
        "touchend",
        () => {

            if (!isTouchActive) {
                return;
            }

            isTouchActive =
                false;

            if (
                isHorizontalSwipe
            ) {

                const diffX =
                    touchMoveX -
                    touchStartX;

                const threshold =
                    60;

                // Pakai cache.
                // Tidak perlu querySelectorAll lagi
                // ketika swipe selesai.
                const allItems =
                    cachedAllItems;

                const containerWidth =
                    preview.clientWidth;

                // Animasi dot
                const dots =
                    preview.querySelectorAll(
                        ".preview-dot"
                    );

                dots.forEach(
                    d => {
                        d.style.transition =
                            "width 0.25s ease-out, background-color 0.25s ease-out";
                    }
                );

                // ======================================
                // SWIPE NEXT
                // ======================================
                if (
                    diffX < -threshold &&
                    currentImageIndex <
                        allItems.length - 1
                ) {

                    updateDotsRealtime(
                        -containerWidth,
                        containerWidth,
                        currentImageIndex,
                        allItems.length
                    );

                    track.style.transition =
                        "transform 0.25s ease-out";

                    track.style.transform =
                        "translate3d(-200%, 0, 0)";

                    setTimeout(
                        () => {
                            showPreviewByIndex(
                                currentImageIndex +
                                    1
                            );
                        },
                        220
                    );

                // ======================================
                // SWIPE PREVIOUS
                // ======================================
                } else if (
                    diffX > threshold &&
                    currentImageIndex > 0
                ) {

                    updateDotsRealtime(
                        containerWidth,
                        containerWidth,
                        currentImageIndex,
                        allItems.length
                    );

                    track.style.transition =
                        "transform 0.25s ease-out";

                    track.style.transform =
                        "translate3d(0%, 0, 0)";

                    setTimeout(
                        () => {
                            showPreviewByIndex(
                                currentImageIndex -
                                    1
                            );
                        },
                        220
                    );

                // ======================================
                // CANCEL SWIPE
                // ======================================
                } else {

                    updateDotsRealtime(
                        0,
                        containerWidth,
                        currentImageIndex,
                        allItems.length
                    );

                    track.style.transition =
                        "transform 0.2s ease-out";

                    track.style.transform =
                        "translate3d(-100%, 0, 0)";
                }
            }

            isHorizontalSwipe =
                false;

            preview.classList.remove(
                "is-swiping"
            );
        },
        {
            passive: true
        }
    );
}