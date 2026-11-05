(() => {
  'use strict';
  const D = window.SITE_DATA;
  const stage = document.getElementById('stage');
  const nav = document.getElementById('section-nav');
  const audio = document.getElementById('shared-audio');
  const helpDialog = document.getElementById('help-dialog');
  const ambientScreen = document.getElementById('ambient-screen');
  const state = {
    section: 0, movie: 0, movieAnswer: false, interview: 0,
    melody: 0, melodyAnswer: false, salad: 0, saladAnswer: false,
    silhouetteRound: 0, silhouetteStatus: 'ready', silhouetteCounts: false, timerLeft: 15,
    uploads: {}, presentation: false, audioPlaying: false, audioKey: '',
    creditsPaused: false
  };
  let silhouetteInterval = null;
  let toastTimeout = null;
  let mouseTimeout = null;
  // Use one master volume/mute preference for every newly created video player.
  // Persist in this browser across page reloads. Never store audio files.
  const videoSoundKey = 'golden-wedding-video-sound-v1';
  function readVideoSound(){
    try {
      const saved=JSON.parse(localStorage.getItem(videoSoundKey)||'null');
      if(saved && Number.isFinite(saved.volume)){
        return {volume:Math.max(0,Math.min(1,saved.volume)),muted:!!saved.muted};
      }
    } catch (_) { /* Private browsing can disable storage. */ }
    return {volume:1,muted:false};
  }
  const videoSound = readVideoSound();
  function saveVideoSound(){
    try {localStorage.setItem(videoSoundKey,JSON.stringify(videoSound));} catch (_) {}
  }
  const safe = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (n) => String(n).padStart(2, '0');
  const fileURL = (key, fallback) => window.WeddingCloud?.fileURL(key, state.uploads[key] || fallback) || state.uploads[key] || fallback;
  function toast(message) {
    const node = document.getElementById('toast'); node.textContent = message; node.classList.add('show');
    clearTimeout(toastTimeout); toastTimeout = setTimeout(() => node.classList.remove('show'), 3600);
  }
  const button = (label, action, klass = 'primary-button', extra = '') => `<button class="${klass}" type="button" data-action="${action}" ${extra}>${label}</button>`;
  const pick = (key, label = 'Выбрать файл', accept = 'video/*') => `<label class="secondary-button file-picker" tabindex="0">${label} <input class="file-input" data-file-key="${safe(key)}" type="file" accept="${accept}"></label>${window.WeddingCloud?.isMedia(key) ? `<span class="cloud-sync-note">${safe(window.WeddingCloud.statusLabel())}</span>` : ''}`;
  const lead = (eyebrow, heading, subtitle = '') => `<p class="eyebrow">${eyebrow}</p><h1 class="stage-h1">${heading}</h1>${subtitle ? `<p class="stage-subtitle">${subtitle}</p>` : ''}`;
  const stepper = (prev, next, current, total) => `<div class="number-stepper">${button('←', prev, '', `aria-label="Предыдущее задание" ${current <= 0 ? 'disabled' : ''}`)}<span class="step-current">${fmt(current+1)} / ${fmt(total)}</span>${button('→', next, '', `aria-label="Следующее задание" ${current >= total-1 ? 'disabled' : ''}`)}</div>`;
  const confetti = () => `<div class="confetti" aria-hidden="true">${Array.from({ length: 26 }, (_, i) => `<i style="left:${(i * 53) % 101}%;animation-delay:${-(i * 0.63)}s;animation-duration:${6 + i % 5}s"></i>`).join('')}</div>`;
  const episode = (kicker, title, count) => `<div class="episode-meta"><div><p class="eyebrow">${safe(kicker)}</p><h1>${safe(title)}</h1></div>${count ? `<span class="counter-pill">${safe(count)}</span>` : ''}</div>`;
  const roundTotal = 15;
  function viewEntrance() {
    const playing = state.audioPlaying && state.audioKey === 'march';
    return `<section class="stage-content">${confetti()}<div class="ring-set" aria-hidden="true"><i></i><i></i></div><p class="eyebrow">ПЕРВЫЙ АККОРД ЭТОГО ВЕЧЕРА</p><h1 class="stage-h1 entrance-h1">Торжественная<br><em>встреча</em></h1><div class="ornament-line">✦</div><p class="stage-subtitle">Встречаем наших главных героев. Пусть вечер начнётся с музыки.</p><div class="stage-actions">${button(playing ? '❚❚ &nbsp; Пауза' : '▶ &nbsp; Марш Мендельсона', 'march-toggle')}${pick('march','Загрузить музыку','audio/*')}</div><p class="intro-note">Звук запускается только по нажатию. Добавьте свой аудиофайл MP3.</p><div class="stage-bottom-fine">ЗОЛОТАЯ СВАДЬБА · 50 ЛЕТ ВМЕСТЕ</div></section>`;
  }
  function viewWelcome() {
    return `<section class="stage-content">${confetti()}<p class="eyebrow">ПРАЗДНИК ЛЮБВИ И СЕМЬИ</p><div class="number-hero">50</div><div class="welcome-title">ЛЕТ ВМЕСТЕ</div><div class="ornament-line">✦</div><div class="welcome-names">${safe(D.names.first)}<br><span style="color:#AC7B2C;font-style:italic">и</span> ${safe(D.names.second)}<br><span class="welcome-family">${safe(D.names.family || 'Смурыгины')}</span></div><div class="hero-rule"></div><p class="stage-subtitle">Сегодня мы собрались, чтобы отметить историю длиною в полвека.<br>Спасибо, что вы разделяете этот вечер с нами.</p><button class="ambient-trigger ambient-welcome-button" type="button" data-action="ambient-open">✦ Показать праздничный фон</button></section>`;
  }
  function videoPlayer(key, path) {
    return `<div class="media-window"><video controls playsinline preload="metadata" src="${safe(fileURL(key,path))}" data-player="${safe(key)}"></video><div class="media-prompt" data-video-prompt="${safe(key)}"><div class="prompt-symbol">▶</div><strong>Здесь будет ваше видео</strong><small>Добавьте файл или выберите его с ноутбука</small></div></div>`;
  }
  function viewWedding() {
    return `<section class="stage-content wide">${episode('НАША ИСТОРИЯ', 'Свадебный ролик', 'ВИДЕО')}<div class="media-layout">${videoPlayer('wedding', D.files.wedding)}<div class="media-side"><p class="eyebrow">ВОСПОМИНАНИЯ</p><h3>История, которую хочется пересматривать</h3><div class="marker-line"></div><p>Готовое свадебное видео появится здесь. Его можно воспроизвести на телевизоре одним нажатием.</p>${pick('wedding','Выбрать свадебное видео','video/*')}<span class="small-note">Поддерживаемый вариант: MP4 (H.264 + AAC).</span></div></div></section>`;
  }
  function viewInterviews() {
    const item = D.interviews[state.interview];
    return `<section class="stage-content wide compact">${episode('ГОЛОСА И ВОСПОМИНАНИЯ', 'Интервью', `${fmt(state.interview+1)} / ${fmt(D.interviews.length)}`)}<div class="media-layout">${videoPlayer(`interview-${state.interview}`,item.src)}<div class="media-side"><p class="eyebrow">ВИДЕО ${fmt(state.interview+1)}</p><h3>${safe(item.title)}</h3><div class="marker-line"></div><p>Переключайте короткие интервью по очереди. Выбранный ролик запускается вручную.</p>${pick(`interview-${state.interview}`,'Выбрать видео для этого интервью','video/*')}<div class="mini-transport">${button('← Предыдущее','interview-prev','small-button',state.interview===0?'disabled':'')}${button('Следующее →','interview-next','small-button',state.interview===D.interviews.length-1?'disabled':'')}</div></div></div><div class="video-switcher">${D.interviews.map((x,i)=>`<button type="button" data-action="interview-jump" data-value="${i}" class="clip-button ${i===state.interview?'active':''}" title="${safe(x.title)}">${fmt(i+1)}</button>`).join('')}</div></section>`;
  }
  function viewMovies() {
    const movie = D.movies[state.movie];
    return `<section class="stage-content compact"><p class="eyebrow">КОНКУРС · КИНОВИКТОРИНА</p><h1 class="stage-h1">Угадай <em>фильм</em></h1><div class="question-card"><div class="film-flare"></div><div class="question-label">КАКОЙ ФИЛЬМ ЗАГАДАН?</div><div class="emojis">${safe(movie.emoji)}</div>${state.movieAnswer ? `<div class="answer-panel"><p>ПРАВИЛЬНЫЙ ОТВЕТ</p><strong>${safe(movie.answer)}</strong></div>` : `<p class="answer-hidden">Посмотрите на эмодзи и назовите фильм</p>`}</div><div class="stage-actions">${button(state.movieAnswer?'Скрыть ответ':'Показать ответ','movie-reveal')}${button('Следующий фильм →','movie-next','secondary-button',state.movie===D.movies.length-1?'disabled':'')}</div>${stepper('movie-prev','movie-next',state.movie,D.movies.length)}<p class="fine-print">Демонстрационные 10 фильмов — позже заменим на окончательный набор.</p></section>`;
  }
  function viewMelodies() {
    const current = D.melodies[state.melody];
    const playing = state.audioPlaying && state.audioKey === `melody-${state.melody}`;
    return `<section class="stage-content compact"><p class="eyebrow">МУЗЫКАЛЬНЫЙ КОНКУРС</p><h1 class="stage-h1">Угадай <em>мелодию</em></h1><div class="melody-art ${playing?'is-playing':''}" aria-hidden="true"></div><p class="section-kicker">КОМПОЗИЦИЯ ${fmt(state.melody+1)} ИЗ ${fmt(D.melodies.length)}</p><p class="stage-subtitle">Слушайте отрывок и угадывайте название композиции.</p>${state.melodyAnswer ? `<div class="answer-panel"><p>ОТВЕТ</p><strong class="${current.answer.includes('не добавлено')?'muted-answer':''}">${safe(current.answer)}</strong></div>` : ''}<div class="stage-actions">${button(playing?'❚❚ Пауза':'▶ Запустить мелодию','melody-toggle')}${pick(`melody-${state.melody}`,'Выбрать MP3','audio/*')}${button(state.melodyAnswer?'Скрыть ответ':'Показать ответ','melody-reveal','secondary-button')}</div>${stepper('melody-prev','melody-next',state.melody,D.melodies.length)}<p class="fine-print">Названия и музыка пока не добавлены — кнопки уже работают с вашими файлами.</p></section>`;
  }
  function viewPairs() {
    return `<section class="stage-content">${confetti()}<div class="ring-set"><i></i><i></i></div>${lead('А ТЕПЕРЬ · ВРЕМЯ ДЛЯ КОМАНД', 'Парный <em>конкурс</em>', 'Найдите себе пару — начинается следующий конкурс!')}<div class="ornament-line">✦</div><p class="fine-print">Это только заставка для объявления конкурса. Правила озвучит ведущий.</p></section>`;
  }
  function viewSalads() {
    const item = D.salads[state.salad];
    return `<section class="stage-content wide compact">${episode('КУЛИНАРНАЯ ВИКТОРИНА', 'Салаты и закуски', `ЗАДАНИЕ ${fmt(state.salad+1)} / ${fmt(D.salads.length)}`)}<div class="salad-display"><div class="salad-frame">${state.saladAnswer?`<img src="${safe(item.photo)}" alt="${safe(item.title)}" data-salad-photo><div class="salad-placeholder" data-photo-placeholder hidden><span>❀</span>Фото блюда добавим позже<small>${safe(item.photo)}</small></div>`:`<div class="salad-placeholder"><span>?</span>Что это за блюдо?<small>Дарья Павловна зачитывает описание вслух</small></div>`}</div><div><p class="eyebrow">УГАДАЙТЕ БЛЮДО</p>${state.saladAnswer?`<div class="salad-reveal-title">${safe(item.title)}</div><p class="salad-lead">Правильный ответ!</p>`:`<div class="salad-reveal-title" style="color:#69323B">Слушаем<br>описание...</div><p class="salad-lead">Ответ появится только после нажатия кнопки ведущим.</p>`}<div class="stage-actions" style="justify-content:flex-start">${button(state.saladAnswer?'Скрыть ответ':'Показать блюдо','salad-reveal')}${button('Следующее →','salad-next','secondary-button',state.salad===D.salads.length-1?'disabled':'')}</div></div></div>${stepper('salad-prev','salad-next',state.salad,D.salads.length)}<p class="fine-print">Пять примерных блюд. Фото и окончательный список добавим после согласования.</p></section>`;
  }
  function viewWord() {
    return `<section class="stage-content">${lead('ЕЩЁ ОДИН СЮРПРИЗ', 'Загаданное <em>слово</em>', 'Здесь появится следующий конкурс, когда согласуем его правила.')}<div class="callout-panel"><div class="ornament-line">?</div><p>Этот раздел уже есть в программе. Когда узнаем механику, добавим подсказки, таймер, буквы или другую нужную интерактивность.</p></div><p class="fine-print">Заглушка черновой версии — конкурс пока не реализован.</p></section>`;
  }
  function viewSilhouettes() {
    const round=state.silhouetteRound;
    const key='silhouette-'+round;
    const url=fileURL(key,'');
    const showing=state.silhouetteStatus==='showing';
    const done=state.silhouetteStatus==='done';
    const board=showing && url
      ? `<div class="silhouette-board silhouette-image-board"><img class="silhouette-user-image" src="${safe(url)}" alt="Изображение с силуэтами, раунд ${round+1}" draggable="false"></div>`
      : `<div class="silhouette-board silhouette-covered"><span class="cover-icon">${done?'⌛':'◈'}</span><strong>${done?'Время вышло!':url?'Картинка готова':'Добавьте картинку раунда'}</strong><p class="stage-subtitle">${done?'Теперь задавайте командам вопросы по увиденным силуэтам':url?'Нажмите «Начать», когда все будут готовы':'Понадобится изображение PNG, JPG или WebP'}</p></div>`;
    return `<section class="stage-content wide compact">${episode('КОНКУРС НА ВНИМАТЕЛЬНОСТЬ','Силуэты',`РАУНД ${round+1} / 2`)}${board}
      <div class="timer-track"><div id="timer-bar" style="width:${showing?state.timerLeft/roundTotal*100:0}%"></div></div>
      <div class="stage-actions">
        ${showing?`<span class="timer-display" id="timer-display">${state.timerLeft.toFixed(1)} с</span>`:button(done?'Повторить раунд':'Начать просмотр · 15 сек','silhouette-start','primary-button',url?'':'disabled')}
        ${!showing?pick(key,'Загрузить картинку раунда','image/png,image/jpeg,image/webp'):''}
        ${!showing?button(round===0?'Раунд 2 →':'← Раунд 1','silhouette-next','small-button'):''}
      </div>
      <p class="fine-print">Ваше изображение видно только во время 15-секундного отсчёта. После таймера оно скрывается. Вопросы и правильные количества ведущий сообщает самостоятельно.</p>
    </section>`;
  }
  function viewCredits() {
    return `<section class="stage-content compact">${confetti()}<p class="eyebrow">СПАСИБО, ЧТО БЫЛИ С НАМИ</p><h1 class="stage-h1">Финальные <em>титры</em></h1><div class="credits-viewport"><div class="credits-inner ${state.creditsPaused?'paused':''}"><div class="credits-block"><span>ЗОЛОТАЯ СВАДЬБА</span><h3>50 лет вместе</h3></div>${D.credits.map(c=>`<div class="credits-block"><span>${safe(c.role)}</span>${c.names.map(n=>`<h3>${safe(n)}</h3>`).join('')}</div>`).join('')}<div class="credits-block"><span>И САМОЕ ГЛАВНОЕ</span><h3>Спасибо нашей семье!</h3></div><div class="credits-final">Продолжение следует… ♡</div></div></div><div class="stage-actions credits-controls">${button(state.creditsPaused?'▶ Продолжить титры':'❚❚ Пауза','credits-pause','secondary-button')}${button('↻ С начала','credits-restart','small-button')}</div><p class="fine-print">Сейчас указаны только известные имена и временные строки. Финальный список уточним.</p></section>`;
  }
  const views = { entrance:viewEntrance,welcome:viewWelcome,wedding:viewWedding,interviews:viewInterviews,movies:viewMovies,melodies:viewMelodies,pairs:viewPairs,salads:viewSalads,word:viewWord,silhouettes:viewSilhouettes,credits:viewCredits };
  function updateNavigation() {
    const mobileSelect = document.getElementById('mobile-stage-select');
    if (mobileSelect) { mobileSelect.innerHTML = D.sections.map((s,i)=>`<option value="${i}">${fmt(i+1)} · ${safe(s.title)}</option>`).join(''); mobileSelect.value=String(state.section); }
    nav.innerHTML = D.sections.map((s,i)=>`<button type="button" class="section-item ${state.section===i?'active':''}" data-action="jump" data-value="${i}" ${state.section===i?'aria-current="step"':''}><span class="section-number">${fmt(i+1)}</span><span class="section-icon">${safe(s.icon)}</span><span class="section-text"><strong>${safe(s.title)}</strong><small>${safe(s.subtitle)}</small></span></button>`).join('');
    nav.querySelector('.active')?.scrollIntoView({block:'nearest'});
    document.getElementById('header-stage-name').textContent = D.sections[state.section].title;
    document.getElementById('footer-title').textContent = D.sections[state.section].title;
    document.getElementById('step-label').textContent = `ЭТАП ${fmt(state.section+1)} / ${fmt(D.sections.length)}`;
    document.getElementById('progress-bar').style.width = `${(state.section+1)/D.sections.length*100}%`;
    document.getElementById('presentation-caption').textContent = `${fmt(state.section+1)} / ${fmt(D.sections.length)}`;
    document.getElementById('nav-total').textContent = `${D.sections.length} ЭТАПОВ`;
    document.querySelector('.controlbar [data-action="previous"]').disabled = state.section===0;
    const nextBtn = document.querySelector('.controlbar [data-action="next"]');
    nextBtn.disabled = state.section===D.sections.length-1;
    nextBtn.innerHTML = state.section===D.sections.length-1?'Конец вечера':'<span class="next-label-desktop">Следующий этап</span><span class="next-label-mobile">Далее</span><span aria-hidden="true">→</span>';
  }
  function syncVideoPrompts() {
    stage.querySelectorAll('video[data-player]').forEach(video => {
      // Apply before playback so the next interview never starts at full volume.
      video.volume = videoSound.volume;
      video.muted = videoSound.muted;
      video.addEventListener('volumechange', () => {
        videoSound.volume = video.volume;
        videoSound.muted = video.muted;
        saveVideoSound();
      });
      const prompt = stage.querySelector(`[data-video-prompt="${video.dataset.player}"]`);
      if (!prompt) return;
      const loaded = () => { prompt.style.display = 'none'; };
      const errored = () => { prompt.style.display = 'flex'; };
      video.addEventListener('loadedmetadata',loaded,{once:true});
      video.addEventListener('error',errored);
      if (video.readyState >= 1) loaded();
    });
    stage.querySelectorAll('img[data-salad-photo]').forEach(img => {
      const placeholder = stage.querySelector('[data-photo-placeholder]');
      const onerr = () => { img.style.display='none'; if (placeholder) placeholder.hidden = false; };
      img.addEventListener('error',onerr,{once:true});
      if (img.complete && !img.naturalWidth) onerr();
    });
  }
  function render() {
    const key = D.sections[state.section].id;
    stage.innerHTML = views[key]();
    stage.scrollTop = 0;
    updateNavigation();
    syncVideoPrompts();
  }
  function stopTimer() { if (silhouetteInterval) {clearInterval(silhouetteInterval);silhouetteInterval=null;} }
  function stopAudio() { audio.pause();audio.currentTime=0;state.audioPlaying=false;state.audioKey=''; }
  function openAmbient(){
    if(!ambientScreen || !ambientScreen.hidden)return;
    closeHostMenu();
    // The backdrop is intended for breaks: avoid sound or an active timed game behind it.
    stage.querySelectorAll('video').forEach(video=>video.pause());
    stopAudio();
    if(state.silhouetteStatus==='showing'){
      stopTimer();state.silhouetteStatus='ready';state.timerLeft=roundTotal;render();
    }
    ambientScreen.hidden=false;
    ambientScreen.setAttribute('aria-hidden','false');
    document.body.classList.add('ambient-active');
    document.getElementById('app-shell').inert = true;
    ambientScreen.querySelector('button')?.focus({preventScroll:true});
  }
  function closeAmbient(){
    if(!ambientScreen || ambientScreen.hidden)return;
    ambientScreen.hidden=true;
    ambientScreen.setAttribute('aria-hidden','true');
    document.body.classList.remove('ambient-active');
    document.getElementById('app-shell').inert = false;
    if(['entrance','melodies'].includes(D.sections[state.section].id))render();
    (document.querySelector('body.presentation .presentation-control .ambient-trigger') ||
      document.querySelector('.topbar .ambient-trigger'))?.focus({preventScroll:true});
  }
  function goTo(index) {
    if (index<0 || index>=D.sections.length || index===state.section) return;
    stopTimer();stopAudio();
    if(state.silhouetteStatus==='showing')state.silhouetteStatus='ready';
    state.section=index;render();
  }
  function audioToggle(key, path) {
    if (state.audioKey===key && !audio.paused) {audio.pause();state.audioPlaying=false;render();return;}
    if (state.audioKey!==key || !audio.src) {audio.pause();audio.src=fileURL(key,path);audio.load();state.audioKey=key;}
    audio.play().then(()=>{state.audioPlaying=true;render();}).catch(()=>{state.audioPlaying=false;toast('Музыка не найдена. Выберите MP3-файл с ноутбука.');render();});
  }
  let silhouettePreloading=false;
  async function startSilhouette() {
    const round=state.silhouetteRound;
    const url=fileURL('silhouette-'+round,'');
    if(!url){toast('Сначала загрузите картинку для этого раунда.');return;}
    if(silhouettePreloading||state.silhouetteStatus==='showing')return;
    silhouettePreloading=true;
    toast('Подготавливаем изображение для показа…');
    try {
      // Start the 15-second timer only after the whole image has loaded.
      const img=new Image();
      img.src=url;
      if(img.decode) await img.decode();
      else await new Promise((resolve,reject)=>{
        if(img.complete&&img.naturalWidth){resolve();return;}
        img.onload=resolve;img.onerror=()=>reject(new Error('Изображение не загрузилось'));
      });
      if(state.silhouetteRound!==round||D.sections[state.section].id!=='silhouettes')return;
      stopTimer();state.silhouetteStatus='showing';state.silhouetteCounts=false;state.timerLeft=roundTotal;render();
      const finishAt=performance.now()+roundTotal*1000;
      silhouetteInterval=setInterval(()=>{
        const left=Math.max(0,(finishAt-performance.now())/1000);state.timerLeft=left;
        const display=document.getElementById('timer-display');if(display)display.textContent=left.toFixed(1)+' с';
        const bar=document.getElementById('timer-bar');if(bar)bar.style.width=left/roundTotal*100+'%';
        if(left===0){stopTimer();state.silhouetteStatus='done';render();toast('Время! Картинка скрыта.');}
      },80);
    }catch(e){toast('Не удалось показать картинку: '+(e.message||'ошибка загрузки'));}
    finally {silhouettePreloading=false;}
  }
  function resetSilhouette(round){stopTimer();state.silhouetteRound=round;state.silhouetteStatus='ready';state.silhouetteCounts=false;state.timerLeft=roundTotal;render();}
  function setFilm(index){if(index<0||index>=D.movies.length)return;state.movie=index;state.movieAnswer=false;render()}
  function setInterview(index){if(index<0||index>=D.interviews.length)return;state.interview=index;render()}
  function setMelody(index){if(index<0||index>=D.melodies.length)return;stopAudio();state.melody=index;state.melodyAnswer=false;render()}
  function setSalad(index){if(index<0||index>=D.salads.length)return;state.salad=index;state.saladAnswer=false;render()}
  function togglePresentation() {
    state.presentation=!state.presentation;document.body.classList.toggle('presentation',state.presentation);
    if (state.presentation) {document.documentElement.requestFullscreen?.().catch(()=>{});} 
    else if(document.fullscreenElement) document.exitFullscreen?.().catch(()=>{});
  }
  function toggleFullscreen(){if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else document.documentElement.requestFullscreen?.().catch(()=>toast('Полный экран недоступен. Можно нажать F11 в браузере.'));}
  const hostMenu=document.getElementById('host-menu');
  function closeHostMenu(){
    if(!hostMenu)return;
    hostMenu.hidden=true;
    document.querySelectorAll('[data-action="menu-toggle"]').forEach(btn=>btn.setAttribute('aria-expanded','false'));
  }
  function toggleHostMenu(){
    if(!hostMenu)return;
    const open=hostMenu.hidden;
    hostMenu.hidden=!open;
    document.querySelectorAll('[data-action="menu-toggle"]').forEach(btn=>btn.setAttribute('aria-expanded',String(open)));
    if(open)hostMenu.querySelector('[data-action]')?.focus({preventScroll:true});
  }
  function handleAction(action,value){
    switch(action){
      case 'next':goTo(state.section+1);break;
      case 'previous':goTo(state.section-1);break;
      case 'jump':goTo(Number(value));break;
      case 'presentation':closeHostMenu();togglePresentation();break;
      case 'fullscreen':closeHostMenu();toggleFullscreen();break;
      case 'menu-toggle':toggleHostMenu();break;
      case 'ambient-open':closeHostMenu();openAmbient();break;
      case 'ambient-close':closeAmbient();break;
      case 'help':closeHostMenu();helpDialog.showModal();break;
      case 'close-help':helpDialog.close();break;
      case 'march-toggle':audioToggle('march',D.files.march);break;
      case 'interview-prev':setInterview(state.interview-1);break;
      case 'interview-next':setInterview(state.interview+1);break;
      case 'interview-jump':setInterview(Number(value));break;
      case 'movie-prev':setFilm(state.movie-1);break;
      case 'movie-next':setFilm(state.movie+1);break;
      case 'movie-reveal':state.movieAnswer=!state.movieAnswer;render();break;
      case 'melody-prev':setMelody(state.melody-1);break;
      case 'melody-next':setMelody(state.melody+1);break;
      case 'melody-toggle':audioToggle(`melody-${state.melody}`,D.melodies[state.melody].src);break;
      case 'melody-reveal':state.melodyAnswer=!state.melodyAnswer;render();break;
      case 'salad-prev':setSalad(state.salad-1);break;
      case 'salad-next':setSalad(state.salad+1);break;
      case 'salad-reveal':state.saladAnswer=!state.saladAnswer;render();break;
      case 'silhouette-start':startSilhouette();break;
      case 'silhouette-next':resetSilhouette(state.silhouetteRound===0?1:0);break;
      case 'credits-pause':state.creditsPaused=!state.creditsPaused;render();break;
      case 'credits-restart':state.creditsPaused=false;render();break;
    }
  }
  document.addEventListener('click',e=>{
    const target=e.target.closest('[data-action]');
    if(target){handleAction(target.dataset.action,target.dataset.value);}
    else if(!e.target.closest('#host-menu'))closeHostMenu();
  });
  document.addEventListener('change',async e=>{
    const input=e.target.closest('[data-file-key]');if(!input?.files?.length)return;
    const file=input.files[0],key=input.dataset.fileKey;
    if(window.WeddingCloud?.isMedia(key) && !window.WeddingCloud.ready()){
      toast('Файл не загружен: сначала нужно подключить облачное хранилище для всех устройств.');
      return;
    }
    if(window.WeddingCloud?.isMedia(key) && window.WeddingCloud.ready()){
      try{
        await window.WeddingCloud.upload(key,file);
        if(key===state.audioKey)stopAudio();
        if(state.uploads[key]){URL.revokeObjectURL(state.uploads[key]);delete state.uploads[key];}
        render();
        toast('Файл сохранён в облаке. На остальных устройствах он появится автоматически.');
      }catch(err){toast('Не удалось загрузить файл: '+err.message)}
      return;
    }
    const previous=state.uploads[key];
    if(previous)URL.revokeObjectURL(previous);
    state.uploads[key]=URL.createObjectURL(file);
    if(key===state.audioKey)stopAudio();
    render();
    toast('Файл выбран только для просмотра на этом устройстве. Чтобы видео появилось везде, сначала подключите облачное хранилище.');
  });
  document.getElementById('mobile-stage-select')?.addEventListener('change',e=>goTo(Number(e.target.value)));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&hostMenu&&!hostMenu.hidden){e.preventDefault();closeHostMenu();return;}
    if(ambientScreen && !ambientScreen.hidden){
      if(e.key==='Escape'||e.key.toLowerCase()==='b'){
        e.preventDefault();closeAmbient();
      }
      return;
    }
    if(e.target.closest('input,textarea,select')||helpDialog.open)return;
    if(e.key.toLowerCase()==='b'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();openAmbient();return;}
    if(e.key==='ArrowRight'){e.preventDefault();goTo(state.section+1);}
    else if(e.key==='ArrowLeft'){e.preventDefault();goTo(state.section-1);}
    else if(e.key.toLowerCase()==='h'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();togglePresentation();}
    else if(e.key.toLowerCase()==='f'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();toggleFullscreen();}
  });
  document.addEventListener('mousemove',()=>{
    if(!state.presentation)return;
    document.body.classList.add('recent-mouse');clearTimeout(mouseTimeout);
    mouseTimeout=setTimeout(()=>document.body.classList.remove('recent-mouse'),2400);
  });
  // Обновление интерфейса при штатном окончании музыки и при ошибке загрузки.
  audio.addEventListener('ended',()=>{state.audioPlaying=false;render();});
  audio.addEventListener('error',()=>{state.audioPlaying=false;if(state.audioKey)toast('Аудиофайл не загрузился. Выберите MP3 с ноутбука или добавьте его в media/.');});
  // Закрытие dialog по клику за пределами содержимого.
  helpDialog.addEventListener('click',e=>{if(e.target===helpDialog)helpDialog.close();});
  document.addEventListener('wedding-cloud-updated',()=>render());
  if(ambientScreen){
    const first=ambientScreen.querySelector('[data-ambient-name="first"]');
    const second=ambientScreen.querySelector('[data-ambient-name="second"]');
    const family=ambientScreen.querySelector('[data-ambient-name="family"]');
    if(first)first.textContent=D.names.first;
    if(second)second.textContent=D.names.second;
    if(family)family.textContent=D.names.family || 'Смурыгины';
  }
  render();
})();
