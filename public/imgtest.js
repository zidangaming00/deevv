const container = document.querySelector(".main-result"); 
const shwrapper = document.querySelector(".show-wrapper"); 
const minWidth = 150; 
const maxColumns = 6; 
const gap = 1; 
let start = 0; 
const maxStart = 30; 
let isLoading = false; 
let lastFetchHeight = 0; 

const searchQuery = urlParams.get("q") || "";

function positionItems() { 
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
        if (imgThumb) imgThumb.style.width = `${itemWidth - 8}px`; 
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

function fetchData() { 
    if (isLoading || start > maxStart) return; 
    isLoading = true; 
    
    fetch(`https://images.searchdata.workers.dev/dimage?q=${encodeURIComponent(searchQuery)}&start=${start}`)
    .then(response => response.json())
    .then(response => { 
        console.log("Response:", response); 
        renderResults(response); 
        start += 10; 
        lastFetchHeight = document.body.scrollHeight; 
        if (shwrapper) {
            shwrapper.innerHTML = ''; 
            shwrapper.style.position = 'absolute'; 
        }
    }).catch(error => { 
        isLoading = false; 
        if (shwrapper) {
            shwrapper.innerHTML = ''; 
            shwrapper.style.position = 'absolute'; 
        }
        console.error("Fetch Error:", error.message); 
    }); 
} 

function renderResults(res) { 
    if (!res || !Array.isArray(res.images) || res.images.length === 0) {
        isLoading = false;
        return;
    }

    let fragment = document.createDocumentFragment(); 
    for (let i = 0; i < res.images.length; i++) { 
        let item = res.images[i];
        let imgElement = document.createElement("img"); 
        imgElement.src = item.thumbnail || item.image; 
        imgElement.loading = "lazy"; 
        imgElement.alt = item.title || "Image"; 
        
        let imgContainer = document.createElement("div"); 
        imgContainer.classList.add("image-item"); 
        imgContainer.setAttribute("tabindex", `tab-${i}`); 
        
        let hostname = "";
        if (item.pageUrl) {
            try {
                hostname = new URL(item.pageUrl).hostname;
            } catch (e) {
                hostname = "";
            }
        }
        
        const faviconSrc = hostname ? `https://datasearch.searchdata.workers.dev/img/${encodeURIComponent(hostname)}` : '';
        const siteName = item.siteName || hostname || "Web";

        imgContainer.innerHTML = ` 
            <div class="image-item__box"> 
                <div class="image-item__dt"> 
                    <div class="image-item__thumb"></div> 
                    <a class="image-item__info" href="${item.pageUrl || '#'}" target="_blank"> 
                        <p class="title" name="t">${item.title || ''}</p> 
                        <p class="image-item__desc"> 
                            ${faviconSrc ? `<img src="${faviconSrc}">` : ''} 
                            <span>${siteName}</span> 
                        </p> 
                    </a> 
                </div> 
            </div>`; 
        
        loadImage(imgElement, item.thumbnail || item.image, item.image); 
        imgContainer.querySelector(".image-item__thumb").appendChild(imgElement); 
        
        imgElement.onload = function() { 
            positionItems(); 
        }; 
        
        imgElement.onerror = function() { 
            let parent = imgElement.closest(".image-item"); 
            if (parent) parent.remove(); 
            positionItems(); 
        }; 
        
        fragment.appendChild(imgContainer); 
    } 
    container.insertBefore(fragment, shwrapper); 
    isLoading = false; 
    positionItems(); 
} 

function loadImage(imgElement, thumbnailSrc, fullSrc) { 
    imgElement.src = thumbnailSrc; 
    imgElement.style.filter = "blur(2px)"; 
    imgElement.style.transition = "filter .5s ease-in-out"; 
    
    if (fullSrc) {
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

window.addEventListener("scroll", function() { 
    if (isLoading) return; 
    const scrollThreshold = 200; 
    const hasScrolledPastLastFetch = window.scrollY > lastFetchHeight - scrollThreshold; 
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100 && hasScrolledPastLastFetch) { 
        if (shwrapper) {
            shwrapper.innerHTML = `<div class="loader"><svg class="circular" viewBox="25 25 50 50"><circle class="path" cx="50" cy="50" r="20" fill="none" stroke-width="4" stroke-miterlimit="10"/></svg></div>`; 
        }
        setTimeout(fetchData, 1000); 
    } 
}); 

fetchData(); 

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
                    <button><a href="" target="_blank">Kunjungi</a></button> 
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
