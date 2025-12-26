// ==UserScript==
// @name         Line Rider Media Overlay Mod
// @namespace    https://www.linerider.com/
// @version      1.0.0
// @description  Add GIFs and videos as overlays inside Line Rider
// @author       You
// @match        https://www.linerider.com/*
// @icon         https://www.linerider.com/favicon.ico
// @grant        none
// ==/UserScript==

(function () {
  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.left = "0";
  overlay.style.top = "0";
  overlay.style.pointerEvents = "none";
  overlay.style.zIndex = "10";
  document.body.appendChild(overlay);

  let media = null;
  let state = {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    opacity: 1
  };

  function addMedia(url, type='gif') {
    if (media) overlay.removeChild(media);
    if (type === 'gif') {
      media = document.createElement('img');
      media.src = url;
    } else if (type === 'video') {
      media = document.createElement('video');
      media.src = url;
      media.autoplay = true;
      media.loop = true;
      media.muted = true;
    }
    media.style.position = 'absolute';
    media.style.transformOrigin = 'center center';
    media.style.opacity = state.opacity;
    overlay.appendChild(media);
    updateTransform();
  }

  function updateTransform() {
    if (!media) return;
    media.style.left = state.x + 'px';
    media.style.top = state.y + 'px';
    media.style.transform = `translate(-50%, -50%) scale(${state.scale}) rotate(${state.rotation}deg)`;
    media.style.opacity = state.opacity;
  }

  // Expose controls
  window.LineRiderMediaMod = {
    addGif: url => addMedia(url, 'gif'),
    addVideo: url => addMedia(url, 'video'),
    setPosition: (x, y) => { state.x = x; state.y = y; updateTransform(); },
    setScale: s => { state.scale = s; updateTransform(); },
    setRotation: deg => { state.rotation = deg; updateTransform(); },
    setOpacity: o => { state.opacity = o; updateTransform(); }
  };

  console.log("Line Rider Media Overlay Mod loaded. Use window.LineRiderMediaMod to add media.");
})();