(() => {
  'use strict';
  const D = window.SITE_DATA;
  const stage = document.getElementById('stage');
  const nav = document.getElementById('section-nav');
  const audio = document.getElementById('shared-audio');
  const helpDialog = document.getElementById('help-dialog');
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
  const safe = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (n) => String(n).padStart(2, '0');
  const fileURL = (key, fallback) => state.uploads[key] || fallback;
  function toast(message) {
    const node = document.getElementById('toast'); node.textContent = message; node.classList.add('show');
    clearTimeout(toastTimeout); toastTimeout = setTimeout(() => node.classList.remove('show'), 3600);
  }
  const button = (label, action, klass = 'primary-button', extra = '') => `<button class="${klass}" type="button" data-action="${action}" ${extra}>${label}</button>`;
  const pick = (key, label = 'Выбрать файл', accept = 'video/*') => `<label class="secondary-button file-picker" tabindex="0">${label} <input class="file-input" data-file-key="${safe(key)}" type="file" accept="${accept}"></label>`;
  const lead = (eyebrow, heading, subtitle = '') => `<p class="eyebrow">${eyebrow}</p><h1 class="stage-h1">${heading}</h1>${subtitle ? `<p class="stage-subtitle">${subtitle}</p>` : ''}`;
  const stepper = (prev, next, current, total) => `<div class="number-stepper">${button('←', prev, '', `aria-label="Предыдущее задание" ${current <= 0 ? 'disabled' : ''}`)}<span class="step-current">${fmt(current+1)} / ${fmt(total)}</span>${button('→', next, '', `aria-label="Следующее задание" ${current >= total-1 ? 'disabled' : ''}`)}</div>`;
  const confetti = () => `<div class="confetti" aria-hidden="true">${Array.from({ length: 26 }, (_, i) => `<i style="left:${(i * 53) % 101}%;animation-delay:${-(i * 0.63)}s;animation-duration:${6 + i % 5}s"></i>`).join('')}</div>`;
  const episode = (kicker, title, count) => `<div class="episode-meta"><div><p class="eyebrow">${safe(kicker)}</p><h1>${safe(title)}</h1></div>${count ? `<span class="counter-pill">${safe(count)}</span>` : ''}</div>`;
  const roundTotal = 15;
  const silhouetteRounds = [
    ['turtle','fish','umbrella','elephant','fish','bird','turtle','umbrella','elephant','fish','turtle','bird','umbrella','turtle','elephant','fish'],
    ['cat','umbrella','fish','elephant','turtle','cat','umbrella','fish','elephant','umbrella','cat','turtle','fish','elephant','umbrella','cat']
  ];
  const silhouetteLabels = { turtle: 'Черепах', fish: 'Рыб', elephant: 'Слонов', umbrella: 'Зонтиков', bird: 'Птиц', cat: 'Кошек' };
  function silhouetteSVG(round) {
    const entries = silhouetteRounds[round];
    const icons = `<defs>
      <symbol id="i-turtle" viewBox="0 0 110 80"><g fill="#242326"><ellipse cx="50" cy="40" rx="32" ry="23"/><circle cx="91" cy="35" r="12"/><path d="M24 23Q11 11 9 27L22 42ZM23 53Q12 63 19 72L38 58ZM66 55Q82 69 89 66L79 50ZM60 15Q73 5 82 16L72 29ZM19 44L1 34L17 55Z"/></g><path d="M30 36Q50 7 74 32" stroke="#242326" fill="none" stroke-width="4"/></symbol>
      <symbol id="i-elephant" viewBox="0 0 110 80"><g fill="#242326"><ellipse cx="47" cy="36" rx="34" ry="25"/><rect x="20" y="44" width="14" height="29" rx="4"/><rect x="64" y="43" width="13" height="30" rx="4"/><circle cx="79" cy="31" r="23"/><ellipse cx="69" cy="32" rx="15" ry="21"/><path d="M93 30Q113 35 101 65Q92 72 88 59L90 44Z"/></g><path d="M94 43L107 46L95 51" fill="#f1eadb"/></symbol>
      <symbol id="i-fish" viewBox="0 0 110 80"><g fill="#242326"><ellipse cx="48" cy="39" rx="34" ry="23"/><path d="M18 40L1 15L1 65Z"/><path d="M42 19L57 2L69 22Z"/><path d="M44 58L63 75L70 57Z"/></g><circle cx="71" cy="34" r="3" fill="#f1eadb"/></symbol>
      <symbol id="i-umbrella" viewBox="0 0 110 80"><path d="M12 40Q17 4 55 5Q94 5 100 40Q88 31 76 41Q65 31 55 41Q44 31 34 41Q21 31 12 40Z" fill="#242326"/><path d="M55 34V65Q55 79 43 73" stroke="#242326" stroke-width="7" stroke-linecap="round" fill="none"/></symbol>
      <symbol id="i-bird" viewBox="0 0 110 80"><g fill="#242326"><ellipse cx="50" cy="44" rx="31" ry="22"/><circle cx="80" cy="21" r="14"/><path d="M92 18L108 26L91 30Z"/><path d="M43 43L13 9L27 49Z"/><path d="M24 45L4 23L10 56Z"/><path d="M54 63V78H48V61ZM67 63V78H61V61Z"/></g></symbol>
      <symbol id="i-cat" viewBox="0 0 110 80"><g fill="#242326"><ellipse cx="54" cy="53" rx="27" ry="22"/><circle cx="55" cy="24" r="22"/><path d="M36 15L31 0L48 8ZM67 8L81 0L76 18Z"/><path d="M73 59Q105 46 100 19" stroke="#242326" stroke-width="12" fill="none" stroke-linecap="round"/></g></symbol>
    </defs>`;
    const placed = entries.map((id, i) => {
      const c = i % 4; const r = Math.floor(i / 4);
      const x = 54 + c*222 + ((i*17)%37)-15;
      const y = 29 + r*123 + ((i*13)%21)-8;
      const angle = [-13,7,16,-9,9,-8,4,13][i%8];
      return `<use href="#i-${id}" x="${x}" y="${y}" width="104" height="80" transform="rotate(${angle} ${x+52} ${y+40})"/>`;
    }).join('');
    return `<svg viewBox="0 0 980 540" role="img" aria-label="Набор силуэтов животных и предметов">${icons}<rect width="980" height="540" fill="#f1eadb"/>${placed}</svg>`;
  }
  function viewEntrance() {
    const playing = state.audioPlaying && state.audioKey === 'march';
    return `<section class="stage-content">${confetti()}<div class="ring-set" aria-hidden="true"><i></i><i></i></div><p class="eyebrow">ПЕРВЫЙ АККОРД ЭТОГО ВЕЧЕРА</p><h1 class="stage-h1 entrance-h1">Торжественная<br><em>встреча</em></h1><div class="ornament-line">✦</div><p class="stage-subtitle">Встречаем наших главных героев. Пусть вечер начнётся с музыки.</p><div class="stage-actions">${button(playing ? '❚❚ &nbsp; Пауза' : '▶ &nbsp; Марш Мендельсона', 'march-toggle')}${pick('march','Загрузить музыку','audio/*')}</div><p class="intro-note">Звук запускается только по нажатию. Добавьте свой аудиофайл MP3.</p><div class="stage-bottom-fine">ЗОЛОТАЯ СВАДЬБА · 50 ЛЕТ ВМЕСТЕ</div></section>`;
  }
  function viewWelcome() {
    return `<section class="stage-content">${confetti()}<p class="eyebrow">ПРАЗДНИК ЛЮБВИ И СЕМЬИ</p><div class="number-hero">50</div><div class="welcome-title">ЛЕТ ВМЕСТЕ</div><div class="ornament-line">✦</div><div class="welcome-names">${safe(D.names.first)}<br><span style="color:#AC7B2C;font-style:italic">и</span> ${safe(D.names.second)}</div><div class="hero-rule"></div><p class="stage-subtitle">Сегодня мы собрались, чтобы отметить историю длиною в полвека.<br>Спасибо, что вы разделяете этот вечер с нами.</p></section>`;
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
    const round = state.silhouetteRound;
    const isShowing = state.silhouetteStatus === 'showing';
    const isDone = state.silhouetteStatus === 'done';
    const board = isShowing ? `<div class="silhouette-board">${silhouetteSVG(round)}</div>` : `<div class="silhouette-board silhouette-covered"><span class="cover-icon">${isDone?'⌛':'◈'}</span><strong>${isDone?'Время вышло!':'Проверьте свою память'}</strong><p class="stage-subtitle">${isDone?'Теперь называйте количество увиденных предметов':'На запоминание будет всего 15 секунд'}</p></div>`;
    const counts = silhouetteRounds[round].reduce((a,k)=>(a[k]=(a[k]||0)+1,a),{});
    return `<section class="stage-content wide compact">${episode('КОНКУРС НА ВНИМАТЕЛЬНОСТЬ','Силуэты',`РАУНД ${round+1} / ${silhouetteRounds.length}`)}${board}<div class="timer-track"><div id="timer-bar" style="width:${isShowing?state.timerLeft/roundTotal*100:0}%"></div></div><div class="stage-actions">${isShowing ? `<span class="timer-display" id="timer-display">${state.timerLeft.toFixed(1)} с</span>` : button(isDone?'Повторить раунд':'Начать просмотр · 15 сек','silhouette-start')}${isDone ? button(state.silhouetteCounts?'Скрыть количества':'Показать количества','silhouette-answers','secondary-button') : ''}${!isShowing ? button(round===0?'Раунд 2 →':'← Раунд 1','silhouette-next','small-button') : ''}</div>${isDone && state.silhouetteCounts?`<div class="counts-grid">${Object.entries(counts).map(([k,n])=>`<span class="count-chip">${silhouetteLabels[k]}: ${n}</span>`).join('')}</div>`:''}<p class="fine-print">Два демонстрационных набора силуэтов. После 15 секунд изображение автоматически скрывается.</p></section>`;
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
  function goTo(index) {
    if (index<0 || index>=D.sections.length || index===state.section) return;
    stopTimer();stopAudio();state.section=index;render();
  }
  function audioToggle(key, path) {
    if (state.audioKey===key && !audio.paused) {audio.pause();state.audioPlaying=false;render();return;}
    if (state.audioKey!==key || !audio.src) {audio.pause();audio.src=fileURL(key,path);audio.load();state.audioKey=key;}
    audio.play().then(()=>{state.audioPlaying=true;render();}).catch(()=>{state.audioPlaying=false;toast('Музыка не найдена. Выберите MP3-файл с ноутбука.');render();});
  }
  function startSilhouette() {
    stopTimer();state.silhouetteStatus='showing';state.silhouetteCounts=false;state.timerLeft=roundTotal;render();
    const finishAt=performance.now()+roundTotal*1000;
    silhouetteInterval=setInterval(()=>{
      const left=Math.max(0,(finishAt-performance.now())/1000);state.timerLeft=left;
      const display=document.getElementById('timer-display');if(display) display.textContent=`${left.toFixed(1)} с`;
      const bar=document.getElementById('timer-bar');if(bar) bar.style.width=`${left/roundTotal*100}%`;
      if(left===0){stopTimer();state.silhouetteStatus='done';render();toast('Время! Картинка скрыта.');}
    },80);
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
  function handleAction(action,value){
    switch(action){
      case 'next':goTo(state.section+1);break;
      case 'previous':goTo(state.section-1);break;
      case 'jump':goTo(Number(value));break;
      case 'presentation':togglePresentation();break;
      case 'fullscreen':toggleFullscreen();break;
      case 'help':helpDialog.showModal();break;
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
      case 'silhouette-answers':state.silhouetteCounts=!state.silhouetteCounts;render();break;
      case 'credits-pause':state.creditsPaused=!state.creditsPaused;render();break;
      case 'credits-restart':state.creditsPaused=false;render();break;
    }
  }
  document.addEventListener('click',e=>{
    const target=e.target.closest('[data-action]');
    if(target){handleAction(target.dataset.action,target.dataset.value);}
  });
  document.addEventListener('change',e=>{
    const input=e.target.closest('[data-file-key]');if(!input?.files?.length)return;
    const key=input.dataset.fileKey;const previous=state.uploads[key];
    if(previous)URL.revokeObjectURL(previous);
    state.uploads[key]=URL.createObjectURL(input.files[0]);
    if(key===state.audioKey)stopAudio();
    render();toast(`Файл «${input.files[0].name}» выбран для просмотра. Для постоянной работы добавьте его в папку media/.`);
  });
  document.getElementById('mobile-stage-select')?.addEventListener('change',e=>goTo(Number(e.target.value)));
  document.addEventListener('keydown',e=>{
    if(e.target.closest('input,textarea,select')||helpDialog.open)return;
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
  render();
})();
