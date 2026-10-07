'use strict';
(() => {
  const guide = document.querySelector('.efc-brand-guide');
  if (!guide) return;
  const status = guide.querySelector('#copy-status');
  const dialog = guide.querySelector('#copy-help');
  const message = guide.querySelector('#copy-help-message');
  const manualCopy = guide.querySelector('#manual-copy');
  const download = guide.querySelector('#fallback-download');
  const buttonTimers = new WeakMap();
  const originalLabels = new WeakMap();
  const blobs = new Map();
  let statusTimer, returnFocus;

  function announce(text) {
    clearTimeout(statusTimer);
    status.textContent = text;
    status.classList.add('visible');
    statusTimer = setTimeout(() => status.classList.remove('visible'), 5000);
  }
  function feedback(button, text, state = 'copied') {
    if (!originalLabels.has(button)) originalLabels.set(button, button.textContent);
    clearTimeout(buttonTimers.get(button));
    button.classList.remove('is-copied', 'is-error');
    button.classList.add(`is-${state}`);
    button.textContent = text;
    buttonTimers.set(button, setTimeout(() => {
      button.textContent = originalLabels.get(button);
      button.classList.remove('is-copied', 'is-error');
    }, 3500));
  }
  function copyFailed(button, { image, text }) {
    feedback(button, 'Could not copy', 'error');
    returnFocus = button;
    manualCopy.hidden = !text;
    manualCopy.value = text || '';
    download.hidden = !image;
    if (image) {
      download.href = image;
      download.textContent = /\.png$/i.test(image) ? 'Download PNG' : 'Download JPG';
    } else {
      download.removeAttribute('href');
    }
    message.textContent = image
      ? 'Your browser could not copy this image. Download the file and upload it to Canva, Slides or your chat instead.'
      : 'Your browser could not copy this text. Select it below and copy it with ⌘C or Ctrl+C.';
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
      if (text) { manualCopy.focus(); manualCopy.select(); }
    } else {
      announce(image ? 'Copy failed. Use the Download link next to the image.' : `Copy failed. Select and copy this text: ${text}`);
    }
  }
  guide.querySelector('#close-copy-help').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => returnFocus?.focus());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });

  async function pngBlob(url) {
    if (blobs.has(url)) return blobs.get(url);
    const promise = (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Image unavailable: ${response.status}`);
      const blob = await response.blob();
      if (blob.type === 'image/png') return blob;
      const objectUrl = URL.createObjectURL(blob);
      try {
        const image = new Image();
        image.src = objectUrl;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx || !canvas.width || !canvas.height) throw new Error('Image conversion unavailable');
        ctx.drawImage(image, 0, 0);
        return await new Promise((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Could not prepare image')), 'image/png'));
      } finally { URL.revokeObjectURL(objectUrl); }
    })();
    blobs.set(url, promise);
    promise.catch(() => blobs.delete(url));
    return promise;
  }

  guide.querySelectorAll('[data-copy-image]').forEach(button => {
    const url = button.dataset.copyImage;
    button.addEventListener('pointerenter', () => pngBlob(url).catch(() => {}), { once: true });
    button.addEventListener('focus', () => pngBlob(url).catch(() => {}), { once: true });
    button.addEventListener('click', async () => {
      try {
        if (!window.isSecureContext || !navigator.clipboard?.write || !window.ClipboardItem) throw new Error('Image clipboard unavailable');
        // Call write during the click gesture. The image data can resolve afterwards.
        const item = new ClipboardItem({ 'image/png': pngBlob(url) });
        const writing = navigator.clipboard.write([item]);
        button.disabled = true;
        await writing;
        feedback(button, 'Image copied');
        announce(`${button.dataset.label} copied. Paste with ⌘V or Ctrl+V.`);
      } catch {
        copyFailed(button, { image: url });
      } finally { button.disabled = false; }
    });
  });
  guide.querySelectorAll('[data-copy-text]').forEach(button => {
    button.addEventListener('click', async () => {
      const text = button.dataset.copyText;
      try {
        if (!window.isSecureContext || !navigator.clipboard?.writeText) throw new Error('Text clipboard unavailable');
        await navigator.clipboard.writeText(text);
        feedback(button, 'Copied');
        announce(`${button.dataset.label} copied.`);
      } catch { copyFailed(button, { text }); }
    });
  });
  const menu = guide.querySelector('.menu-toggle');
  const navigation = guide.querySelector('#navigation');
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('open', open);
    menu.textContent = open ? 'Close' : 'Menu';
  });
  navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    navigation.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false');
    menu.textContent = 'Menu';
  }));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navigation.querySelectorAll('a').forEach(link => {
          if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -65% 0px' });
    guide.querySelectorAll('main>section[id]').forEach(section => observer.observe(section));
  }
})();
