/* Golden Wedding v1.0 — Cloudinary Free uploads and cross-device video + MP3 index.
   No server-side credentials in the repository. The unsigned upload preset is public:
   only use with non-confidential family media and a dedicated Cloudinary account. */
(() => {
  'use strict';
  const cfg = window.WEDDING_MEDIA_CONFIG || {};
  const cloudName = String(cfg.cloudName || '').trim();
  const uploadPreset = String(cfg.uploadPreset || '').trim();
  const tag = String(cfg.tag || 'golden_wedding_50_family_2026').trim();
  const configured =
    cfg.provider === 'cloudinary' &&
    /^[A-Za-z0-9_-]{2,64}$/.test(cloudName) &&
    /^[A-Za-z0-9_-]{2,120}$/.test(uploadPreset) &&
    /^[A-Za-z0-9_-]{2,120}$/.test(tag);
  const isVideo = key => key === 'wedding' || /^interview-(?:[0-9]|1[0-5])$/.test(key);
  const isAudio = key => key === 'march' || /^melody-(?:[0-9]|1[0-9])$/.test(key);
  const isImage = key => /^silhouette-[01]$/.test(key);
  const isMedia = key => isVideo(key) || isAudio(key) || isImage(key);
  const stored = new Map();
  let busy = false;
  let refreshing = false;
  let abortUpload = null;
  let lastError = '';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function overlay() {
    let el = document.getElementById('cloud-upload-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cloud-upload-status';
      el.hidden = true;
      el.innerHTML = '<div class="cloud-uploader" role="status" aria-live="polite">' +
        '<div class="cloud-symbol">✦</div><h2>Загрузка файла</h2>' +
        '<p class="cloud-filename"></p><div class="cloud-track"><div class="cloud-fill"></div></div>' +
        '<p class="cloud-message"></p><small>Не закрывайте страницу до завершения.</small>' +
        '<button type="button" class="cloud-cancel">Отменить загрузку</button></div>';
      document.body.appendChild(el);
    }
    return el;
  }
  function progress(text, pct) {
    const el = overlay();
    el.hidden = false;
    el.querySelector('.cloud-message').textContent = text;
    el.querySelector('.cloud-fill').style.width = Math.max(0, Math.min(100, pct)) + '%';
  }
  function fileURL(slot, fallback) {
    if (!configured || !isMedia(slot)) return fallback;
    return stored.get(slot)?.url || fallback;
  }
  function parseSlot(asset) {
    const context = asset.context?.custom || asset.context || {};
    const key = context.slot || context.wedding_slot;
    return typeof key === 'string' && isMedia(key) ? key : null;
  }
  function assetUrl(asset, kind) {
    const base = 'https://res.cloudinary.com/' + cloudName + '/' + kind + '/upload/';
    if (typeof asset.secure_url === 'string' && asset.secure_url.startsWith(base)) {
      return asset.secure_url;
    }
    if (typeof asset.public_id !== 'string' || !/^[a-z0-9]+$/i.test(asset.format || '')) return '';
    const id = asset.public_id.split('/').map(encodeURIComponent).join('/');
    const version = Number(asset.version);
    return base + (Number.isFinite(version) && version > 0 ? 'v' + version + '/' : '') +
      id + '.' + asset.format;
  }
  async function loadList(kind) {
    const url = 'https://res.cloudinary.com/' + encodeURIComponent(cloudName) +
      '/' + kind + '/list/' + encodeURIComponent(tag) + '.json?refresh=' + Date.now();
    const r = await fetch(url, {cache:'no-store'});
    // Before first upload, a Cloudinary public list can legitimately be 404.
    if (r.status === 404) return [];
    if (!r.ok) throw new Error('Список '+kind+' Cloudinary недоступен ('+r.status+'). Проверьте Resource list.');
    const body = await r.json();
    if (!Array.isArray(body.resources)) throw new Error('Неверный список '+kind+' Cloudinary.');
    return body.resources;
  }
  async function refresh() {
    if (!configured || busy || refreshing) return false;
    refreshing = true;
    try {
      const [videos, images] = await Promise.all([loadList('video'),loadList('image')]);
      const updated = new Map();
      for (const [kind, assets] of [['video',videos],['image',images]]) {
        for (const asset of assets) {
          const slot = parseSlot(asset);
          if (!slot || isImage(slot) !== (kind === 'image')) continue;
          const url = assetUrl(asset,kind);
          if (!url) continue;
          const version=Number(asset.version)||0;
          const record={url,version};
          if (!updated.has(slot) || updated.get(slot).version < version) updated.set(slot,record);
        }
      }
      // The tag manifests are eventually consistent. Keep uploads visible instantly.
      for (const [slot,item] of stored) {
        if (item.justUploaded && (!updated.has(slot) || updated.get(slot).version < item.version)) {
          updated.set(slot,item);
        }
      }
      const changed = JSON.stringify([...updated]) !== JSON.stringify([...stored]);
      stored.clear();
      for (const [key,record] of updated) stored.set(key,record);
      lastError='';
      if (changed) document.dispatchEvent(new Event('wedding-cloud-updated'));
      return true;
    } catch(err) {
      lastError=err.message || 'Ошибка синхронизации';
      console.warn('Не удалось обновить общий список файлов:',err);
      return false;
    } finally { refreshing=false; }
  }
  async function upload(slot, file) {
    if (!configured) throw new Error('Сначала настройте бесплатный Cloudinary по инструкции в GitHub.');
    if (!isMedia(slot)) throw new Error('Этот раздел не поддерживает облачную загрузку.');
    if (busy) throw new Error('Дождитесь завершения предыдущей загрузки.');
    if (!file || !file.size) throw new Error('Выберите непустой файл.');
    const audioFile = isAudio(slot);
    const imageFile = isImage(slot);
    if (imageFile && !/\.(png|jpg|jpeg|webp)$/i.test(file.name)) throw new Error('Для силуэтов нужны PNG, JPG или WebP.');
    if (audioFile && !/\.mp3$/i.test(file.name)) throw new Error('Для музыки нужен MP3-файл.');
    if (!audioFile && !imageFile && !/\.mp4$/i.test(file.name)) throw new Error('Для видео нужен MP4 (H.264 + AAC).');
    if (imageFile && file.size > 10 * 1024 * 1024) throw new Error('Картинка должна быть меньше 10 МБ.');
    if (file.size > 100 * 1024 * 1024) throw new Error('Бесплатный тариф ограничивает файл 100 МБ.');
    busy = true;
    const el = overlay();
    const cancel = el.querySelector('.cloud-cancel');
    el.querySelector('.cloud-filename').textContent = file.name;
    el.querySelector('h2').textContent = imageFile ? 'Загрузка изображения' : audioFile ? 'Загрузка аудио' : 'Загрузка видео';
    cancel.disabled = false;
    progress(imageFile ? 'Подготавливаем картинку…' : audioFile ? 'Подготавливаем MP3…' : 'Подготавливаем видео…', 0);
    try {
      const data = new FormData();
      data.append('file', file);
      data.append('upload_preset', uploadPreset);
      data.append('tags', tag);
      data.append('context', 'slot=' + slot);
      const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        abortUpload = () => xhr.abort();
        xhr.open('POST', 'https://api.cloudinary.com/v1_1/' +
          encodeURIComponent(cloudName) + '/' + (imageFile ? 'image' : 'video') + '/upload', true);
        xhr.upload.onprogress = event => {
          if (!event.lengthComputable) return;
          const pct = Math.round(event.loaded / event.total * 95);
          progress('Передаём видео: ' + pct + '%', pct);
        };
        xhr.onerror = () => reject(new Error('Проблема с интернетом во время загрузки.'));
        xhr.onabort = () => reject(new Error('Загрузка отменена.'));
        xhr.onload = () => {
          let response = {};
          try { response = JSON.parse(xhr.responseText || '{}'); } catch (_) {}
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(response.error?.message || 'Cloudinary вернул ошибку ' + xhr.status));
            return;
          }
          if (typeof response.secure_url !== 'string' ||
              !response.secure_url.startsWith('https://res.cloudinary.com/')) {
            reject(new Error('Cloudinary не вернул адрес видео.'));
            return;
          }
          resolve(response);
        };
        xhr.send(data);
      });
      progress('Готово! Сохраняем файл в общем списке…', 100);
      stored.set(slot, {url:result.secure_url, version:Number(result.version) || Date.now(), justUploaded:true});
      document.dispatchEvent(new Event('wedding-cloud-updated'));
      // The public Cloudinary tag list can take up to 60 seconds to reflect new assets.
      await sleep(700);
      return true;
    } finally {
      busy = false;
      abortUpload = null;
      cancel.onclick = null;
      el.hidden = true;
    }
  }
  function statusLabel() {
    if (!configured) return '⚠ Облачная загрузка пока не включена. Настройте Cloudinary.';
    return lastError ?
      '⚠ Список видео пока не синхронизирован: ' + lastError :
      '☁ Файл сохранится в Cloudinary и появится на других устройствах (обычно до 1 минуты).';
  }

  window.WeddingCloud = {
    ready: () => configured, isVideo, isAudio, isImage, isMedia, upload, refresh, fileURL, statusLabel
  };
  if (configured) {
    document.addEventListener('DOMContentLoaded', () => {
      refresh();
      setInterval(() => {if (!document.hidden) refresh();}, 30000);
      document.addEventListener('visibilitychange', () => {if (!document.hidden) refresh();});
    });
  }
})();
