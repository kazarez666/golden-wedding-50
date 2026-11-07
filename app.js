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
    melody: 0, melodyAnswer: false, melodyPhase: 'idle',
    silhouetteRound: 0, silhouetteStatus: 'ready', silhouetteAnswer: false, silhouetteCounts: false, timerLeft: 20,
    uploads: {}, presentation: false, audioPlaying: false, audioKey: '',
    creditsPaused: false
  };
  let silhouetteInterval = null;
  let toastTimeout = null;
  let mouseTimeout = null;
  let creditsAnimation = null;
  let creditsRenderToken = 0;
  const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
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
  const melodySettingsKey = 'golden-wedding-melody-cues-v2';
  const melodyVolumeKey = 'golden-wedding-melody-volume-v1';
  function loadMelodySettings(){
    try {
      const value=JSON.parse(localStorage.getItem(melodySettingsKey)||'{}');
      return value && typeof value==='object' && !Array.isArray(value) ? value : {};
    }catch(_){return {};}
  }
  const melodySettings = loadMelodySettings();
  let melodyVolume=.8;
  try {
    const saved=localStorage.getItem(melodyVolumeKey);
    if(saved!==null){
      const value=Number(saved);
      if(Number.isFinite(value)&&value>=0&&value<=1)melodyVolume=value;
    }
  }catch(_){}
  const melodyTime = value => {
    if(!Number.isFinite(value) || value<0)return '--:--';
    const n=Math.floor(value);
    return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
  };
  function melodyInfo(index=state.melody){
    const base=D.melodies[index]||{};
    const override=melodySettings[String(index)]||{};
    const positive=v=>v!==null&&v!==''&&Number.isFinite(Number(v))?Math.max(0,Number(v)):null;
    const verseStart=positive(override.verseStart??base.verseStart)??0;
    const chorusStart=positive(override.chorusStart??base.chorusStart);
    // The answer chorus can be BEFORE the selected quiz verse in the MP3.
    // verseEnd is an independent stop marker; existing saved settings remain valid.
    const verseEnd=positive(override.verseEnd??base.verseEnd);
    return {
      ...base,
      answer:String(override.answer??base.answer??''),
      cueStatus:override.verseStart!==undefined || override.verseEnd!==undefined ||
        override.chorusStart!==undefined ? 'locally_adjusted' : base.cueStatus,
      verseStart, verseEnd, chorusStart
    };
  }
  // Cue order is independent: only the verse end must follow verse start.
  const melodyReady = item => item.chorusStart!==null &&
    Number.isFinite(item.verseStart) && item.verseStart>=0;
  const melodyClueEnd = item => item.verseEnd!==null && item.verseEnd>item.verseStart
    ? item.verseEnd : item.chorusStart!==null && item.chorusStart>item.verseStart
    ? item.chorusStart : item.verseStart+20;
  function saveMelodySetting(field,value){
    const key=String(state.melody);
    const entry={...(melodySettings[key]||{})};
    if(field==='answer'){
      entry.answer=String(value).trim().slice(0,150);
    }else if(field==='verseStart'||field==='verseEnd'||field==='chorusStart'){
      const number=Number(String(value).trim().replace(',','.'));
      entry[field]=String(value).trim()===''||!Number.isFinite(number)||number<0 ? null : Math.round(number*10)/10;
    }else return;
    melodySettings[key]=entry;
    try{localStorage.setItem(melodySettingsKey,JSON.stringify(melodySettings));}catch(_){}
  }
  const fileURL = (key, fallback) => window.WeddingCloud?.fileURL(key, state.uploads[key] || fallback) || state.uploads[key] || fallback;
  // Song metadata and tentative cue points are not the audio recording itself.
  const melodyHasFile = (index=state.melody) => {
    const key='melody-'+index;
    return Boolean(state.uploads[key] || window.WeddingCloud?.hasFile?.(key));
  };
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
  const roundTotal = 20;
  function viewEntrance() {
    const playing = state.audioPlaying && state.audioKey === 'march';
    return `<section class="stage-content">
      <div class="ring-set" aria-hidden="true"><i></i><i></i></div>
      <p class="eyebrow">ПЕРВЫЙ АККОРД ЭТОГО ВЕЧЕРА</p>
      <h1 class="stage-h1 entrance-h1">Торжественная<br><em>встреча</em></h1>
      <div class="ornament-line" aria-hidden="true">✦</div>
      <div class="stage-actions">${button(playing ? '❚❚ &nbsp; Пауза' : '▶ &nbsp; Марш Мендельсона', 'march-toggle')}</div>
      <div class="stage-bottom-fine">ЗОЛОТАЯ СВАДЬБА · 50 ЛЕТ ВМЕСТЕ</div>
    </section>`;
  }
  function viewWelcome() {
    return `<section class="stage-content stage-welcome">
      <div class="welcome-editorial">
        <p class="welcome-overline">ЗОЛОТАЯ СВАДЬБА</p>
        <div class="welcome-figure" aria-label="50 лет">50</div>
        <div class="wedding-divider" aria-hidden="true"><i></i><span class="wedding-rings"><b></b><b></b></span><i></i></div>
        <p class="welcome-anniversary">ЛЕТ ВМЕСТЕ</p>
        <div class="welcome-couple">
          <div class="welcome-person">${safe(D.names.first)}</div>
          <div class="welcome-connector" aria-label="и"><i></i><span>и</span><i></i></div>
          <div class="welcome-person">${safe(D.names.second)}</div>
          <div class="welcome-surname">${safe(D.names.family || 'Смурыгины')}</div>
        </div>
        <button class="welcome-ambient-link" type="button" data-action="ambient-open">✦ &nbsp;Праздничный фон</button>
      </div>
    </section>`;
  }
  function videoPlayer(key, path) {
    // Media assets were uploaded in advance. Only playback belongs on the show screen.
    return `<div class="media-window"><video controls playsinline preload="metadata" src="${safe(fileURL(key,path))}" data-player="${safe(key)}"></video></div>`;
  }
  function viewWedding() {
    return `<section class="stage-content wide ceremony-video-screen">
      ${episode('ИСТОРИЯ ПАВЛА СЕМЁНОВИЧА И ОЛЬГИ ЛЕОНИДОВНЫ', 'Свадебный ролик', 'ВИДЕО')}
      <div class="ceremony-video-panel">${videoPlayer('wedding', D.files.wedding)}</div>
      <div class="ceremony-video-upload">${pick('wedding','Загрузить свадебный ролик','video/*')}</div>
    </section>`;
  }
  function viewInterviews() {
    const item = D.interviews[state.interview];
    return `<section class="stage-content wide compact ceremony-interview-screen">
      ${episode('ВОПРОСЫ И ОТВЕТЫ', 'Интервью', `${fmt(state.interview+1)} / ${fmt(D.interviews.length)}`)}
      <div class="media-layout">
        ${videoPlayer(`interview-${state.interview}`,item.src)}
        <div class="media-side">
          <p class="eyebrow">ВИДЕО ${fmt(state.interview+1)}</p>
          <h3>${safe(item.title)}</h3>
          <div class="marker-line" aria-hidden="true"></div>
          <div class="mini-transport">
            ${button('← Предыдущее','interview-prev','small-button',state.interview===0?'disabled':'')}
            ${button('Следующее →','interview-next','small-button',state.interview===D.interviews.length-1?'disabled':'')}
          </div>
        </div>
      </div>
      <div class="video-switcher">
        ${D.interviews.map((x,i)=>`<button type="button" data-action="interview-jump" data-value="${i}" class="clip-button ${i===state.interview?'active':''}" title="${safe(x.title)}">${fmt(i+1)}</button>`).join('')}
      </div>
    </section>`;
  }
  function viewMovies() {
    const movie = D.movies[state.movie];
    return `<section class="stage-content compact"><p class="eyebrow">КОНКУРС · КИНОВИКТОРИНА</p><h1 class="stage-h1">Угадай <em>фильм</em></h1><div class="question-card"><div class="film-flare"></div><div class="question-label">КАКОЙ ФИЛЬМ ЗАГАДАН?</div><div class="emojis">${safe(movie.emoji)}</div>${state.movieAnswer ? `<div class="answer-panel"><p>ПРАВИЛЬНЫЙ ОТВЕТ</p><strong>${safe(movie.answer)}</strong></div>` : `<p class="answer-hidden">Посмотрите на эмодзи и назовите фильм</p>`}</div><div class="stage-actions">${button(state.movieAnswer?'Скрыть ответ':'Показать ответ','movie-reveal')}${button('Следующий фильм →','movie-next','secondary-button',state.movie===D.movies.length-1?'disabled':'')}</div>${stepper('movie-prev','movie-next',state.movie,D.movies.length)}<p class="fine-print">10 фильмов, выбранных для праздничного вечера.</p></section>`;
  }
  function viewMelodies() {
    const current=melodyInfo();
    const key='melody-'+state.melody;
    const playing=state.audioKey===key&&!audio.paused&&!audio.ended;
    const configured=melodyReady(current);
    const hasFile=melodyHasFile();
    const answerDefined=current.answer.trim()&&current.answer!=='Название ещё не добавлено';
    const phase=state.melodyPhase;
    const cueNote=current.cueStatus==='preliminary'
      ? 'Метки предварительные: найдены по синхронизированному тексту другой записи. Сверьте с загруженным MP3.'
      : current.cueStatus==='locally_adjusted'
      ? 'Метки изменены в этом браузере. Проверьте границу куплета по загруженному MP3.'
      : 'Для этой песни надёжные метки пока не найдены. Без записи секунды будут выдумкой.';
    const status=phase==='waiting'
      ? 'Куплет закончился. Ждём ответы гостей.'
      : phase==='chorus' ? 'Звучит припев — правильный ответ открыт.'
      : phase==='clue' ? (playing?'Звучит куплет — слушаем и угадываем.':'Куплет на паузе.')
      : phase==='preview' ? (playing?'Режим настройки: прослушивание полной песни.':'Прослушивание на паузе.')
      : !hasFile ? 'MP3 не загружен. Сначала добавьте запись в настройки песни.'
      : configured ? 'Запись есть. Куплет остановится в '+melodyTime(melodyClueEnd(current))+'.'
        : 'Запись загружена. Укажите начало припева в настройках.';
    return `<section class="stage-content wide compact melody-game-screen">
      ${episode('МУЗЫКАЛЬНЫЙ КОНКУРС','Продолжи песню',`ТРЕК ${fmt(state.melody+1)} / ${fmt(D.melodies.length)}`)}
      <div class="melody-game-layout">
        <div class="melody-main-panel">
          <div class="melody-disc-row">
            <div class="melody-art ${playing?'is-playing':''}" aria-hidden="true"></div>
            <div class="melody-live-copy">
              <p class="melody-phase-label">${state.melodyAnswer?'ПРАВИЛЬНЫЙ ОТВЕТ':'УГАДАЙТЕ КОМПОЗИЦИЮ'}</p>
              ${state.melodyAnswer
                ? `<div class="melody-big-answer">${safe(answerDefined?current.answer:'Название ещё не добавлено')}</div>`
                : `<div class="melody-question-mark">♫ <span>Что за песня?</span></div>`}
              <p class="melody-play-status" data-melody-status role="status">${safe(status)}</p>
            </div>
          </div>
          <div class="melody-transport" aria-label="Управление музыкой">
            <div class="melody-progress-head"><span data-melody-current>00:00</span><span data-melody-duration>--:--</span></div>
            <input type="range" data-melody-seek min="0" max="100" step="0.1" value="0" aria-label="Перемотка песни" class="melody-range melody-seek" />
            <div class="melody-transport-buttons">
              ${button('▶ Куплет','melody-clue','primary-button')}
              ${button(playing?'❚❚ Пауза':'▶ Продолжить','melody-pause','secondary-button',state.audioKey!==key||phase==='waiting'?'disabled':'')}
              ${button('↻ Сначала','melody-restart','small-button')}
            </div>
            <div class="melody-volume-control">
              <label for="melody-volume">Громкость</label>
              <input id="melody-volume" type="range" min="0" max="100" step="1" value="${Math.round(melodyVolume*100)}" data-melody-volume class="melody-range" aria-label="Громкость музыки"/>
              <output data-melody-volume-value>${Math.round(melodyVolume*100)}%</output>
            </div>
          </div>
          <div class="melody-reveal-row">
            ${button(state.melodyAnswer?'Скрыть ответ':'✦ Показать ответ и включить припев',state.melodyAnswer?'melody-hide':'melody-reveal','primary-button')}
            ${state.melodyAnswer?button('↻ Повторить припев','melody-chorus','secondary-button'):''}
          </div>
        </div>
        <details class="melody-setup" ${state.melodySetupOpen?'open':''}>
          <summary aria-label="Настройки MP3, ответов и фрагментов песни">⚙ Настроить аудиофайл и фрагмент</summary>
          <div class="melody-setup-body">
            <p class="melody-help">Загрузите один полный MP3 и укажите три независимые точки. Припев может идти РАНЬШЕ куплета — это нормально.</p>
            <p class="melody-help">Если конец куплета не указан: при обычном порядке музыка остановится перед припевом; если припев раньше куплета, куплет прозвучит 20 секунд. Можно поставить собственный конец отрывка.</p>
            <p class="melody-cue-note" data-cue-warning>${safe(cueNote)}</p>
            ${pick(key,'Загрузить песню MP3','audio/mpeg,.mp3')}
            ${button('▶ Прослушать всю запись','melody-preview','secondary-button')}
            <label class="melody-config-label">Исполнитель — название
              <input data-melody-setting="answer" type="text" value="${safe(current.answer==='Название ещё не добавлено'?'':current.answer)}" placeholder="Например: Корни — 25 этаж" autocomplete="off"/>
            </label>
            <div class="melody-cue-grid">
              <label class="melody-config-label">Начало куплета (секунды)
                <input type="number" min="0" step="0.1" data-melody-setting="verseStart" value="${current.verseStart}"/>
              </label>
              ${button('Отметить начало куплета','melody-mark-verse','small-button')}
              <label class="melody-config-label">Конец куплета — точка остановки (секунды, необязательно)
                <input type="number" min="0" step="0.1" data-melody-setting="verseEnd" value="${current.verseEnd===null?'':current.verseEnd}" placeholder="Например: 76.3"/>
              </label>
              ${button('Отметить конец куплета','melody-mark-verse-end','small-button')}
              <label class="melody-config-label">Начало припева (секунды)
                <input type="number" min="0" step="0.1" data-melody-setting="chorusStart" value="${current.chorusStart===null?'':current.chorusStart}" placeholder="Например: 42.5"/>
              </label>
              ${button('Отметить начало припева','melody-mark-chorus','small-button')}
            </div>
            <p class="melody-help">Настройки на этой странице сохраняются в браузере устройства. Когда согласуем песни, перенесу ответы и метки в проект, чтобы они работали на всех устройствах.</p>
          </div>
        </details>
      </div>
      ${stepper('melody-prev','melody-next',state.melody,D.melodies.length)}
      <p class="fine-print">Куплет играет от своей начальной метки до точки остановки. После раскрытия ответа начинается припев со своей метки, даже если в MP3 она находится раньше куплета.</p>
    </section>`;
  }
  // These three competitions are hosted in person; the site only announces
  // which stage is next, without displaying rules, examples or answers.
  function announcementSlide(title,kind) {
    // Individual asymmetric composition; only the contest name is public text.
    return `<section class="stage-content announcement-screen announcement-${kind}">
      <div class="announcement-copy">
        <span class="announcement-stroke" aria-hidden="true"></span>
        <h1 class="announcement-title">${safe(title)}</h1>
      </div>
    </section>`;
  }
  function viewPairs() { return announcementSlide('Парный конкурс','pairs'); }
  function viewSalads() { return announcementSlide('Конкурс «Салаты и закуски»','salads'); }
  function viewWord() { return announcementSlide('Конкурс «Загаданное слово»','word'); }
  function viewSilhouettes() {
    const round=state.silhouetteRound;
    const key='silhouette-'+round;
    const url=fileURL(key,'');
    const showing=state.silhouetteStatus==='showing';
    const done=state.silhouetteStatus==='done';
    const answersVisible=done&&state.silhouetteAnswer;
    const answers=D.silhouetteAnswers?.[round]||[];
    // The quiz photo is hidden once the countdown ends. Correct counts remain
    // secret until the presenter explicitly reveals them.
    const board=answersVisible
      ? `<div class="silhouette-answers-board" aria-label="Ответы раунда ${round+1}">
           <h2 class="silhouette-answers-heading">Правильные ответы</h2>
           <div class="silhouette-answers-grid">
             ${answers.map(item=>`<div class="silhouette-answer-item"><strong>${Number(item.count)}</strong><span>${safe(item.label)}</span></div>`).join('')}
           </div>
         </div>`
      : showing && url
      ? `<div class="silhouette-board silhouette-image-board"><img class="silhouette-user-image" src="${safe(url)}" alt="Изображение с силуэтами, раунд ${round+1}" draggable="false"></div>`
      : `<div class="silhouette-board silhouette-covered"><span class="cover-icon" aria-hidden="true">${done?'⌛':'◈'}</span><strong>${done?'Время вышло!':'Раунд '+(round+1)}</strong></div>`;
    return `<section class="stage-content wide compact silhouette-game-screen">
      ${episode('КОНКУРС НА ВНИМАТЕЛЬНОСТЬ','Силуэты',`РАУНД ${round+1} / 2`)}
      ${board}
      <div class="timer-track"><div id="timer-bar" style="width:${showing?state.timerLeft/roundTotal*100:0}%"></div></div>
      <div class="stage-actions silhouette-controls">
        ${showing?`<span class="timer-display" id="timer-display">${state.timerLeft.toFixed(1)} с</span>`:button(done?'Повторить раунд':'Начать просмотр · 20 сек','silhouette-start','primary-button',url?'':'disabled')}
        ${done?button(answersVisible?'Скрыть ответы':'Показать ответы','silhouette-answer','secondary-button'):''}
        ${!showing?button(round===0?'Раунд 2 →':'← Раунд 1','silhouette-next','small-button'):''}
      </div>
    </section>`;
  }
  function viewCredits() {
    return `<section class="stage-content compact credits-screen">
      <div class="credits-head" aria-label="Завершение праздничной программы">
        <p class="credits-overline">ЗОЛОТАЯ СВАДЬБА · 50 ЛЕТ ВМЕСТЕ</p>
        <div class="credits-headline"><span class="credits-gold-mark" aria-hidden="true">✦</span><h1>История любви <em>длиною в полвека</em></h1><span class="credits-gold-mark" aria-hidden="true">✦</span></div>
        <div class="credits-subtitle">Павел Семёнович и Ольга Леонидовна ${safe(D.names.family||'Смурыгины')}</div>
      </div>
      <div class="credits-viewport" aria-label="Титры участников праздника">
        <div class="credits-inner">
          <div class="credits-block credits-lead">
            <span>ЭТОТ ВЕЧЕР ПОСВЯЩАЕТСЯ</span>
            <h3>Павлу Семёновичу<br>и Ольге Леонидовне</h3>
            <p>50 лет вместе</p>
          </div>
          ${D.credits.map(c=>`<div class="credits-block"><span>${safe(c.role)}</span>${c.names.map(n=>`<h3>${safe(n)}</h3>`).join('')}</div>`).join('')}
          <div class="credits-block credits-thanks">
            <span>С ЛЮБОВЬЮ И БЛАГОДАРНОСТЬЮ</span>
            <h3>Спасибо за этот вечер!</h3>
          </div>
          <div class="credits-final">Продолжение следует… ♡</div>
        </div>
      </div>
      <div class="stage-actions credits-controls">
        ${button(state.creditsPaused?'▶ Продолжить':'❚❚ Пауза','credits-pause','secondary-button')}
        ${button('↻ С начала','credits-restart','small-button')}
      </div>
      <p class="fine-print credits-note">Титры предварительные — участники и роли будут дополнены перед праздником.</p>
    </section>`;
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
  }
  function startCreditsScroll() {
    const token = ++creditsRenderToken;
    if(creditsAnimation){ creditsAnimation.cancel(); creditsAnimation=null; }
    if(D.sections[state.section].id!=='credits')return;
    requestAnimationFrame(()=>{
      if(token!==creditsRenderToken||D.sections[state.section].id!=='credits')return;
      const viewport=stage.querySelector('.credits-viewport');
      const inner=stage.querySelector('.credits-inner');
      if(!viewport||!inner||reduceMotion())return;
      const distance=Math.ceil(inner.scrollHeight+viewport.clientHeight);
      const duration=Math.max(42000,Math.round(distance/33*1000));
      creditsAnimation=inner.animate([
        {transform:'translateY(0)'},
        {transform:'translateY(-'+distance+'px)'}
      ],{duration,delay:1100,easing:'linear',fill:'forwards',iterations:1});
      if(state.creditsPaused)creditsAnimation.pause();
    });
  }
  function toggleCreditsPause() {
    if(D.sections[state.section].id!=='credits')return;
    state.creditsPaused=!state.creditsPaused;
    if(creditsAnimation){
      if(state.creditsPaused)creditsAnimation.pause();
      else creditsAnimation.play();
    }
    const btn=stage.querySelector('[data-action="credits-pause"]');
    if(btn)btn.textContent=state.creditsPaused?'▶ Продолжить':'❚❚ Пауза';
  }
  function restartCredits(){
    if(D.sections[state.section].id!=='credits')return;
    state.creditsPaused=false;
    const btn=stage.querySelector('[data-action="credits-pause"]');
    if(btn)btn.textContent='❚❚ Пауза';
    startCreditsScroll();
  }
  // One gold wipe for navigation and item changes. Unlike subtle fading,
  // it visibly crosses the whole stage, then reveals the next frame.
  let activeGoldWipe=null;
  function createGoldWipe(mode){
    if(reduceMotion())return null;
    activeGoldWipe?.remove();
    const curtain=document.createElement('div');
    curtain.className='gold-wipe gold-wipe-'+mode;
    curtain.setAttribute('aria-hidden','true');
    curtain.innerHTML='<span class="gold-wipe-seal"><b>50</b><small>ЛЕТ ВМЕСТЕ</small></span>';
    curtain.style.clipPath='inset(0 100% 0 0)';
    stage.scrollTop=0;
    stage.appendChild(curtain);
    activeGoldWipe=curtain;
    return curtain;
  }
  async function moveGoldWipe(curtain,enter,mode){
    if(!curtain||!curtain.isConnected)return;
    const duration=mode==='scene' ? (enter?540:590) : (enter?440:480);
    const from=enter?'inset(0 100% 0 0)':'inset(0 0 0 0)';
    const to=enter?'inset(0 0 0 0)':'inset(0 0 0 100%)';
    const animation=curtain.animate([{clipPath:from},{clipPath:to}],
      {duration,easing:'cubic-bezier(.76,0,.24,1)',fill:'forwards'});
    try{await animation.finished;}catch(_){}
    if(!curtain.isConnected)return;
    curtain.style.clipPath=to;
    animation.cancel();
  }
  async function closeGoldWipe(curtain,mode){
    if(!curtain)return;
    try{
      if(curtain.isConnected){
        await new Promise(resolve=>setTimeout(resolve,mode==='scene'?150:95));
        await moveGoldWipe(curtain,false,mode);
      }
    }finally{
      curtain.remove();
      if(activeGoldWipe===curtain)activeGoldWipe=null;
    }
  }
    function render({enter=false,swap=false} = {}) {
    const key = D.sections[state.section].id;
    stage.classList.toggle('scene-enter',enter&&!reduceMotion());
    stage.classList.toggle('item-enter',swap&&!reduceMotion());
    stage.dataset.scene=key;
    const curtain=stage.querySelector(':scope > .gold-wipe');
    if(curtain)curtain.remove();
    stage.innerHTML = views[key]();
    if(curtain)stage.appendChild(curtain);
    stage.scrollTop = 0;
    updateNavigation();
    syncVideoPrompts();
    if(key==='melodies')updateMelodyControls();
    if(key==='credits')startCreditsScroll();
    else if(creditsAnimation){creditsAnimation.cancel();creditsAnimation=null;++creditsRenderToken;}
  }
  function stopTimer() { if (silhouetteInterval) {clearInterval(silhouetteInterval);silhouetteInterval=null;} }
  function stopAudio() { audio.pause();audio.currentTime=0;state.audioPlaying=false;state.audioKey='';state.melodyPhase='idle'; }
  function openAmbient(){
    if(!ambientScreen || !ambientScreen.hidden)return;
    closeHostMenu();
    // The backdrop is intended for breaks: avoid sound or an active timed game behind it.
    stage.querySelectorAll('video').forEach(video=>video.pause());
    stopAudio();
    if(state.silhouetteStatus==='showing'){
      stopTimer();state.silhouetteStatus='ready';state.silhouetteAnswer=false;state.timerLeft=roundTotal;render();
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
  let sceneChangeToken=0;
  let itemChangeToken=0;
  async function goTo(index) {
    if(index<0 || index>=D.sections.length || index===state.section)return;
    const token=++sceneChangeToken;
    ++itemChangeToken;
    stopTimer();stopAudio();
    stage.querySelectorAll('video').forEach(video=>video.pause());
    if(state.silhouetteStatus==='showing')state.silhouetteStatus='ready';
    const curtain=createGoldWipe('scene');
    try{
      await moveGoldWipe(curtain,true,'scene');
      if(token!==sceneChangeToken)return;
      state.section=index;
      render({enter:true});
      await closeGoldWipe(curtain,'scene');
    }finally{
      if(curtain?.isConnected)curtain.remove();
      if(activeGoldWipe===curtain)activeGoldWipe=null;
    }
  }
  function audioToggle(key, path) {
    if (state.audioKey===key && !audio.paused) {audio.pause();state.audioPlaying=false;render();return;}
    if (state.audioKey!==key || !audio.src) {audio.pause();audio.src=fileURL(key,path);audio.load();state.audioKey=key;}
    audio.play().then(()=>{state.audioPlaying=true;render();}).catch(()=>{state.audioPlaying=false;toast('Музыка не найдена. Выберите MP3-файл с ноутбука.');render();});
  }
  // The master audio element is shared with the entrance march.
  // For the melody quiz use a single complete track with cue markers.
  function prepareMelodyAudio(){
    const key='melody-'+state.melody;
    const url=fileURL(key,D.melodies[state.melody].src);
    if(state.audioKey!==key || audio.dataset.melodySource!==url){
      audio.pause();
      audio.src=url;
      audio.dataset.melodySource=url;
      audio.load();
    }
    state.audioKey=key;
    audio.volume=melodyVolume;
    audio.muted=false;
    return key;
  }
  function updateMelodyControls(){
    if(D.sections[state.section].id!=='melodies')return;
    const key='melody-'+state.melody;
    const isCurrent=state.audioKey===key;
    const duration=isCurrent&&Number.isFinite(audio.duration)?audio.duration:null;
    const time=isCurrent&&Number.isFinite(audio.currentTime)?audio.currentTime:0;
    const seek=stage.querySelector('[data-melody-seek]');
    if(seek){
      seek.max=String(duration&&duration>0?duration:100);
      seek.value=String(Math.min(duration&&duration>0?duration:100,time));
    }
    const cueWarning=stage.querySelector('[data-cue-warning]');
    if(cueWarning){
      const cfg=melodyInfo();
      if(cfg.cueStatus==='preliminary' && duration && cfg.referenceDuration &&
         Math.abs(duration-cfg.referenceDuration)>3){
        cueWarning.textContent='⚠ Длительность загруженного MP3 ('+melodyTime(duration)+
          ') отличается от версии из синхронизированного текста ('+melodyTime(cfg.referenceDuration)+
          '). Эти метки не гарантируют остановку перед припевом. Их надо перепроверить.';
      }else if(cfg.cueStatus==='locally_adjusted'){
        cueWarning.textContent='Метки изменены в браузере этого устройства. Проверьте, что куплет обрывается до припева.';
      }else if(cfg.cueStatus==='preliminary'){
        cueWarning.textContent='Предварительные метки из синхронизированного текста. Прослушайте запись перед праздником.';
      }else{
        cueWarning.textContent='Надёжных меток нет. Неизвестна точная версия записи.';
      }
    }
    const currentLabel=stage.querySelector('[data-melody-current]');
    if(currentLabel)currentLabel.textContent=melodyTime(time);
    const durationLabel=stage.querySelector('[data-melody-duration]');
    if(durationLabel)durationLabel.textContent=melodyTime(duration);
    const statusLabel=stage.querySelector('[data-melody-status]');
    if(statusLabel){
      const phase=state.melodyPhase;
      statusLabel.textContent=phase==='waiting'?'Куплет закончился. Ждём ответы гостей.'
        : phase==='chorus'?(audio.paused?'Припев на паузе.':'Звучит припев — правильный ответ открыт.')
        : phase==='clue'?(audio.paused?'Куплет на паузе.':'Звучит куплет — слушаем и угадываем.')
        : phase==='preview'?(audio.paused?'Прослушивание на паузе.':'Прослушивание полной песни для настройки.')
        : melodyReady(melodyInfo())?'Готово к игре.':'Установите начало припева в настройках.';
    }
    const pause=stage.querySelector('[data-action="melody-pause"]');
    if(pause){
      pause.disabled=!isCurrent||state.melodyPhase==='waiting'||state.melodyPhase==='idle';
      pause.textContent=isCurrent&&!audio.paused?'❚❚ Пауза':'▶ Продолжить';
    }
    const art=stage.querySelector('.melody-art');
    if(art)art.classList.toggle('is-playing',isCurrent&&!audio.paused);
  }
  function playMelody(mode){
    const cfg=melodyInfo();
    if(!melodyHasFile()){
      toast('Для трека '+fmt(state.melody+1)+' MP3 пока отсутствует. Откройте «Настройка песни и фрагмента» и загрузите запись.');
      updateMelodyControls();
      return;
    }
    if((mode==='clue'||mode==='chorus')&&!melodyReady(cfg)){
      toast('Укажите начало куплета и начало припева — их порядок может быть любым.');
      if(mode==='chorus'){
        state.melodyAnswer=true;render({swap:true});
      }
      return;
    }
    const previousKey=state.audioKey;
    prepareMelodyAudio();
    let target=0;
    if(mode==='clue')target=cfg.verseStart;
    else if(mode==='chorus')target=cfg.chorusStart;
    else target=previousKey===state.audioKey && Number.isFinite(audio.currentTime)?audio.currentTime:0;
    if(Number.isFinite(target)){
      try{audio.currentTime=target;}catch(_){}
    }
    state.melodyPhase=mode;
    if(mode==='clue')state.melodyAnswer=false;
    if(mode==='chorus')state.melodyAnswer=true;
    const promise=audio.play();
    render({swap:mode==='chorus'});
    Promise.resolve(promise).then(()=>{
      state.audioPlaying=true;
      updateMelodyControls();
    }).catch(err=>{
      state.audioPlaying=false;
      audio.pause();
      updateMelodyControls();
      toast('Не удалось воспроизвести песню. Проверьте, что MP3 загружен. '+(err?.message||''));
    });
  }
  function pauseMelody(){
    if(state.audioKey!=='melody-'+state.melody || state.melodyPhase==='waiting')return;
    if(!audio.paused){
      audio.pause();state.audioPlaying=false;updateMelodyControls();return;
    }
    audio.play().then(()=>{state.audioPlaying=true;updateMelodyControls();})
      .catch(()=>toast('Не удалось продолжить запись.'));
  }
  function restartMelody(){
    audio.pause();state.audioPlaying=false;
    state.melodyPhase='idle';state.melodyAnswer=false;
    if(state.audioKey==='melody-'+state.melody){
      try{audio.currentTime=melodyInfo().verseStart;}catch(_){}
    }
    render({swap:true});
  }
  function revealMelody(){
    if(state.melodyAnswer){restartMelody();return;}
    playMelody('chorus');
  }
  function markMelodyCue(field){
    if(state.audioKey!=='melody-'+state.melody || !Number.isFinite(audio.currentTime)){
      toast('Сначала запустите прослушивание песни, затем поставьте метку.');return;
    }
    const seconds=Math.round(audio.currentTime*10)/10;
    saveMelodySetting(field,seconds);
    const input=stage.querySelector('[data-melody-setting="'+field+'"]');
    if(input)input.value=String(seconds);
    updateMelodyControls();
    const names={verseStart:'Начало куплета',verseEnd:'Конец куплета',chorusStart:'Начало припева'};
    toast(names[field]+' — '+melodyTime(seconds)+'. Метка сохранена.');
  }
  audio.addEventListener('timeupdate',()=>{
    if(state.audioKey==='melody-'+state.melody && state.melodyPhase==='clue'){
      const cfg=melodyInfo();
      const end=melodyClueEnd(cfg);
      if(melodyReady(cfg)&&audio.currentTime>=end-.035){
        state.melodyPhase='waiting';
        audio.pause();
        state.audioPlaying=false;
        try{audio.currentTime=end;}catch(_){}
      }
    }
    updateMelodyControls();
  });
  audio.addEventListener('loadedmetadata',updateMelodyControls);
  audio.addEventListener('durationchange',updateMelodyControls);
  audio.addEventListener('play',updateMelodyControls);
  audio.addEventListener('pause',updateMelodyControls);
  let silhouettePreloading=false;
  async function startSilhouette() {
    const round=state.silhouetteRound;
    const url=fileURL('silhouette-'+round,'');
    if(!url){toast('Сначала загрузите картинку для этого раунда.');return;}
    if(silhouettePreloading||state.silhouetteStatus==='showing')return;
    silhouettePreloading=true;
    toast('Подготавливаем изображение для показа…');
    try {
      // Start the 20-second timer only after the whole image has loaded.
      const img=new Image();
      img.src=url;
      if(img.decode) await img.decode();
      else await new Promise((resolve,reject)=>{
        if(img.complete&&img.naturalWidth){resolve();return;}
        img.onload=resolve;img.onerror=()=>reject(new Error('Изображение не загрузилось'));
      });
      if(state.silhouetteRound!==round||D.sections[state.section].id!=='silhouettes')return;
      stopTimer();state.silhouetteStatus='showing';state.silhouetteAnswer=false;state.silhouetteCounts=false;state.timerLeft=roundTotal;render();
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
  function resetSilhouette(round){stopTimer();state.silhouetteRound=round;state.silhouetteStatus='ready';state.silhouetteAnswer=false;state.silhouetteCounts=false;state.timerLeft=roundTotal;render({swap:true});}
  async function switchWithinStage(kind, selector, apply){
    const section=state.section;
    if(D.sections[section].id!==kind)return;
    const token=++itemChangeToken;
    // Stop old video or audio BEFORE the curtain moves, never autoplay the next.
    if(kind==='interviews')stage.querySelectorAll('video').forEach(video=>video.pause());
    if(kind==='melodies')stopAudio();
    const curtain=createGoldWipe('item');
    try{
      await moveGoldWipe(curtain,true,'item');
      if(token!==itemChangeToken || state.section!==section)return;
      apply();
      render({swap:true});
      await closeGoldWipe(curtain,'item');
    }finally{
      if(curtain?.isConnected)curtain.remove();
      if(activeGoldWipe===curtain)activeGoldWipe=null;
    }
  }
  function setFilm(index){
    if(index<0||index>=D.movies.length||index===state.movie)return;
    switchWithinStage('movies','.question-card',()=>{state.movie=index;state.movieAnswer=false});
  }
  function setInterview(index){
    if(index<0||index>=D.interviews.length||index===state.interview)return;
    switchWithinStage('interviews','.media-layout',()=>{state.interview=index});
  }
  function setMelody(index){
    if(index<0||index>=D.melodies.length||index===state.melody)return;
    switchWithinStage('melodies','.melody-art',()=>{state.melody=index;state.melodyAnswer=false});
  }
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
      case 'movie-reveal':state.movieAnswer=!state.movieAnswer;render({swap:true});break;
      case 'melody-prev':setMelody(state.melody-1);break;
      case 'melody-next':setMelody(state.melody+1);break;
      case 'melody-clue':playMelody('clue');break;
      case 'melody-preview':playMelody('preview');break;
      case 'melody-pause':pauseMelody();break;
      case 'melody-restart':restartMelody();break;
      case 'melody-reveal':revealMelody();break;
      case 'melody-hide':restartMelody();break;
      case 'melody-chorus':playMelody('chorus');break;
      case 'melody-mark-verse':markMelodyCue('verseStart');break;
      case 'melody-mark-verse-end':markMelodyCue('verseEnd');break;
      case 'melody-mark-chorus':markMelodyCue('chorusStart');break;
      case 'silhouette-start':startSilhouette();break;
      case 'silhouette-answer':if(state.silhouetteStatus==='done'){state.silhouetteAnswer=!state.silhouetteAnswer;render({swap:true});}break;
      case 'silhouette-next':resetSilhouette(state.silhouetteRound===0?1:0);break;
      case 'credits-pause':toggleCreditsPause();break;
      case 'credits-restart':restartCredits();break;
    }
  }
  document.addEventListener('click',e=>{
    const target=e.target.closest('[data-action]');
    if(target){handleAction(target.dataset.action,target.dataset.value);}
    else if(!e.target.closest('#host-menu'))closeHostMenu();
  });
  // Keep the emergency MP3 controls open across player re-renders.
  document.addEventListener('toggle',e=>{
    if(e.target.matches?.('.melody-setup'))state.melodySetupOpen=e.target.open;
  },true);
  document.addEventListener('input',e=>{
    const seek=e.target.closest('[data-melody-seek]');
    if(seek && D.sections[state.section].id==='melodies'){
      if(!melodyHasFile()){toast('В этом задании нет MP3 для перемотки.');return;}
      prepareMelodyAudio();
      const value=Number(seek.value);
      if(Number.isFinite(value)){try{audio.currentTime=value;}catch(_){}}
      updateMelodyControls();
      return;
    }
    const volume=e.target.closest('[data-melody-volume]');
    if(volume){
      melodyVolume=Math.max(0,Math.min(1,Number(volume.value)/100));
      audio.volume=melodyVolume;
      audio.muted=false;
      try{localStorage.setItem(melodyVolumeKey,String(melodyVolume));}catch(_){}
      const output=stage.querySelector('[data-melody-volume-value]');
      if(output)output.textContent=Math.round(melodyVolume*100)+'%';
    }
  });
  document.addEventListener('change',async e=>{
    const setting=e.target.closest('[data-melody-setting]');
    if(setting && D.sections[state.section].id==='melodies'){
      saveMelodySetting(setting.dataset.melodySetting,setting.value);
      toast('Настройка песни сохранена в этом браузере.');
      updateMelodyControls();
      return;
    }
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
  audio.addEventListener('ended',()=>{
    state.audioPlaying=false;
    if(state.audioKey.startsWith('melody-')){
      state.melodyPhase='idle';
      updateMelodyControls();
    }else render();
  });
  audio.addEventListener('error',()=>{
    state.audioPlaying=false;
    if(state.audioKey.startsWith('melody-')){
      toast('Не удалось прочитать этот MP3. Проверьте загрузку файла и обновите страницу.');
      updateMelodyControls();
    }else if(state.audioKey){
      toast('Аудиофайл не загрузился. Проверьте источник записи.');
    }
  });
  // Закрытие dialog по клику за пределами содержимого.
  helpDialog.addEventListener('click',e=>{if(e.target===helpDialog)helpDialog.close();});
  document.addEventListener('wedding-cloud-updated',()=>{
    const current=D.sections[state.section].id;
    // Keep the final scroll and other non-media stages uninterrupted.
    if(['wedding','interviews','entrance','melodies','silhouettes'].includes(current))render();
  });
  if(ambientScreen){
    const first=ambientScreen.querySelector('[data-ambient-name="first"]');
    const second=ambientScreen.querySelector('[data-ambient-name="second"]');
    const family=ambientScreen.querySelector('[data-ambient-name="family"]');
    if(first)first.textContent=D.names.first;
    if(second)second.textContent=D.names.second;
    if(family)family.textContent=D.names.family || 'Смурыгины';
  }
  render({enter:true});
})();
