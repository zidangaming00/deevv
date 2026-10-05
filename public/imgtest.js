/* --- Video Grid & Cards --- */
.video-grid {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px; 
  padding: 8px 6px; 
  background: var(--color-white, #ffffff);
  box-sizing: border-box;
}

.video-card {
  width: 100%;
  margin: 0;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  overflow: hidden;
  position: relative;
}

.video-card:active,
.video-card:hover {
  border-color: rgba(0, 0, 0, 0.12);
}

.video-card a {
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  height: 100%;
  -webkit-tap-highlight-color: transparent;
}

.video-card__thumb-wrapper {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
  background: #f1f3f4;
  overflow: hidden;
}

.video-card .thumbnail {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s cubic-bezier(0.2, 0, 0, 1); 
}

.video-card:active .thumbnail,
.video-card:hover .thumbnail {
  transform: scale(1.12); 
}

.video-card__play-badge {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 32px;
  height: 32px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.video-card__play-badge svg {
  width: 14px;
  height: 14px;
  fill: #ffffff;
  margin-left: 2px;
}

.video-card__content {
  padding: 8px 6px 10px;
  display: flex;
  flex-direction: column;
  flex: 1;
  justify-content: space-between;
}

.video-card__duration {
  position: absolute;
  bottom: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.8);
  color: #ffffff;
  font-size: 10.5px;
  font-weight: 500;
  padding: 2.5px 5px;
  border-radius: 4px;
  letter-spacing: 0.3px;
  line-height: 1;
  pointer-events: none;
  z-index: 2;
}

.video-card .title {
  color: #202124;
  margin: 0 0 6px 0;
  font-size: var(--dtext-small);
  font-weight: 500;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
   min-height: 35.1px;
}

.video-card .source {
  font-size: 11px;
  color: #5f6368;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.video-card .info {
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  white-space: nowrap;
}

.video-card .favicon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.video-card .channel-name {
  overflow: hidden;
  text-overflow: ellipsis;
  color: #4d5156;
}

.video-card .time-ago {
  color: #70757a;
  font-size: 10.5px;
}

/* --- Image Results & Grid --- */
.main-result {
  position: relative;     
  box-sizing: border-box;
  overflow: hidden;
}

.main-result:has(.image-item) {
  margin-top: 8px !important;
}

.image-item {
  position: absolute;     
  box-sizing: border-box;
  transition: transform 0.3s ease;
  will-change: transform;
}
.image-item__box {
  padding-top: 0px;
  box-sizing: border-box;  
}
.image-item__thumb {
  overflow: hidden;
  position: relative;
  border-radius: 16px;
  background-color: #e9e9ec;
  cursor: pointer;
  display: flex;
  box-sizing: border-box;
  width: 100%;             
  -webkit-tap-highlight-color: transparent;
}
.image-item__thumb img { width: 100%; }
.image-item__info { padding: 0 2px; display: flex; flex-direction: column; justify-content: start; }
.image-item__info p, .image-item__info span { color: var(--color-text); font-size: 12px; font-family: 'Google Sans', Roboto, sans-serif; }
.image-item__desc { align-items: center; display: flex; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; gap: 6px; }
.image-item__desc img { width: 16px; border-radius: 50%; }
.image-item__info .title { font-weight: 500; }
a.image-item__info { padding: 6px 6px 0 6px; display: flex; flex-direction: column; gap: 2px; text-decoration: none; }
.image-item__info p { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.image-grid { display: grid; grid-template-rows: 1fr 1fr; gap: 4px; overflow: hidden; border-radius: 12px; grid-auto-flow: column; }
.image-grid__main { grid-column: span 2; grid-row: 1 / -1; }
.image-grid__cell { background: #ededed; }
.image-grid__cell--side { height: 90px; }
.image-grid__caption { padding: 0 16px 4px 16px; }
.image-grid__cell img { width: 100%; height: 100%; object-fit: cover; }

/* --- Image Preview & Carousel --- */
.image-preview {
  width: 100%; 
  height: 100dvh;
  background: #f5f8fa;
  position: fixed; 
  left: 0; 
  top: 0; 
  z-index: 9999;
  font-family: 'Google Sans', Roboto, sans-serif;
  overflow: hidden; 
  transform: translateZ(0);
}

.preview-card-track {
  display: flex;
  width: 100%;
  height: 100%;
  transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
  will-change: transform;
  transform: translateZ(0);
}

.preview-card-page {
  min-width: 100%;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto; 
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  background: #ffffff;
  box-sizing: border-box;
  contain: content;
}

.image-preview__header { 
  padding: 12px 16px; 
  display: flex; 
  align-items: center; 
  justify-content: space-between; 
  border-bottom: 1px solid #f1f3f4;
  background: #fff;
  flex-shrink: 0;
}
.image-preview__header .left { display: flex; gap: 10px; align-items: center; }
.image-preview .title { font-size: 14px; font-weight: 500; color: #202124; }
.image-preview__favicon { width: 30px; height: 30px; border: 1px solid #ededed; background: #f9f9f9; border-radius: 50%; display: grid; place-items: center; }
.image-preview__favicon img { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; }

.image-preview__body {
  flex: 1;
  min-height: 0;           
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.image-preview__thumbnail { 
  position: relative; 
  background: #000000;
  display: flex; 
  align-items: center; 
  justify-content: center;
  width: 100%; 
  flex-shrink: 0;
}

.image-preview__thumbnail img { 
  width: 100%; 
  height: auto; 
  max-height: 60vh; 
  object-fit: contain; 
  display: block;
}

.preview-carouselTrack {
    display: flex;
    width: 100%;
    transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
    will-change: transform;
}

.preview-slide {
    min-width: 100%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}

.image-preview__footer { 
  padding: 12px 16px; 
  display: flex; 
  justify-content: space-between; 
  align-items: center;
  background: #fff;
}
.image-preview__footer .left { padding-right: 12px; }
.image-preview__footer .title { font-size: 15px; font-weight: 500; line-height: 1.3; }
.image-preview__footer .site { margin-top: 4px; font-size: 12px; color: #70757a; }
.image-preview__footer button {
  padding: 8px 18px; 
  background: #1a73e8; 
  border: none; 
  border-radius: 20px; 
  font-weight: 500; 
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}
.image-preview__footer button a { color: #fff; text-decoration: none; }

/* OPTIMASI DOTS: Hilangkan backdrop-filter blur agar mulus di HP Kentang */
.preview-dots {
  position: fixed;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10001;
  display: flex !important;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(32, 33, 36, 0.9);
  border-radius: 10px;
  pointer-events: none;
}

.preview-dot {
  width: 6px; 
  height: 6px;
  border-radius: 3px;
  background-color: #ffffff;
  opacity: 0.4;
  transition: width 0.1s linear, opacity 0.1s linear;
  will-change: width, opacity;
}

.preview-dot.active {
    width: 16px;
    height: 6px;
    border-radius: 3px;
    background-color: #ffffff;
    opacity: 1;
}

.image-preview__actions {
  display: flex;
  gap: 10px;
  padding: 6px 16px 12px 16px;
  background: #ffffff;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 20px;
  border: none;
  background: #e8f0fe;
  font-size: var(dtext-small);
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.2s ease;
}

.action-btn:active {
  background: #d2e3fc;
}

.action-btn svg {
  fill: currentColor;
}

.image-preview__related {
  padding: 12px 6px 32px;
  border-top: 8px solid #f1f3f4;
  background: #fff;
}
.image-preview__related .related-title {
  font-size: 16px;
  font-weight: 500;
  margin: 0 6px 12px;
  color: #202124;
}

/* --- Modified Related Grid (Masonry / Varied Height) --- */
.related-grid {
  column-count: 2;
  column-gap: 6px;
  padding: 0;
  box-sizing: border-box;
}

.related-card {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  break-inside: avoid;
  margin-bottom: 8px;
}

.related-card__thumb {
  width: 100%;
  height: auto;
  border-radius: 16px;
  overflow: hidden;
  background: #ededed;
}

.related-card__thumb img {
  width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
}

.related-card__title {
  font-size: 12px;
  color: #3c4043;
  margin-top: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.3;
}

.related-loader, .related-empty {
  column-span: all;
  width: 100%;
  font-size: 13px;
  color: #70757a;
  padding: 12px 0;
  text-align: center;
}

.related-note {
  grid-column: span 2;
  font-size: 12px;
  color: #70757a;
  padding: 2px 10px 6px;
}

/* --- Consolidated Media Queries & Dark Mode --- */

@media (min-width: 600px) {
   .result-wrapper {
    padding: 12px;
  }
   
  .video-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    padding: 12px;
  }
  
  .video-card:first-child {
    grid-column: auto;
    margin-bottom: 0;
  }
  
  .video-card .video-card__content {
    padding: 14px;
  }

  .video-card:first-child .title {
    font-size: 13px;
    font-weight: 500;
  }
}

@media (min-width: 1200px) {
  .video-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}

@media (min-width: 1024px) {
    .image-preview {
        position: fixed;
        top: 0;
        right: 0;
        left: auto;
        width: 440px;
        height: 100vh;
        background: #ffffff;
        border-left: 1px solid #dadce0;
        box-shadow: -4px 0 12px rgba(0, 0, 0, 0.15);
        z-index: 999;
        overflow: hidden; 
    }

    .preview-card-track {
        display: flex;
        height: 100%;
        width: 300%; 
    }

    .preview-card-page {
        width: 100%;
        height: 100vh;
        overflow-y: auto; 
        -webkit-overflow-scrolling: touch;
    }

    .preview-card-page::-webkit-scrollbar {
        width: 8px;
    }

    .preview-card-page::-webkit-scrollbar-thumb {
        background-color: rgba(0, 0, 0, 0.2);
        border-radius: 4px;
    }

    .preview-card-page::-webkit-scrollbar-track {
        background: transparent;
    }

    body.dark .image-preview {
        background: #202125;
        border-left-color: #3c4043;
    }

    body.dark .preview-card-page::-webkit-scrollbar-thumb {
        background-color: rgba(255, 255, 255, 0.2);
    }
}

body.dark .video-grid {
  background: #121212;
}

body.dark .video-card {
  background: #1e1e1e;
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: none;
}

body.dark .video-card .title {
  color: #e8eaed;
}

body.dark .video-card .channel-name {
  color: #bdc1c6;
}

body.dark .video-card .time-ago {
  color: #9aa0a6;
}

body.dark .image-preview { background: #171717; }
body.dark .image-preview__header, 
body.dark .image-preview__footer, 
body.dark .image-preview__related { background: #202125; border-color: #3c4043; }
body.dark .image-preview .title, 
body.dark .image-preview__related .related-title,
body.dark .related-card__title { color: #e8eaed; }

body.dark .image-preview__actions {
  background: #202125;
}

body.dark .action-btn {
  background: #2d2e31;
}

body.dark .action-btn:active {
  background: #3c4043;
}
