/* Ceremony soundtracks v2.8: separate from march and melody quiz. */
(()=>{
'use strict';
const stage=document.getElementById('stage');
if(!stage)return;
const tracks={wedding:new Audio(),credits:new Audio()};
const urls={wedding:'media/wedding-soundtrack.mp3',credits:'media/credits-soundtrack.mp3'};
const local={};
let scene='',creditsStarted=false,creditsPaused=true,attachedVideo=null;
const dbName='golden-wedding-ceremony-songs-v1';
function openDB(){return new Promise((resolve,reject)=>{
  if(!window.indexedDB)return reject(new Error('Хранилище недоступно'));
  const r=indexedDB.open(dbName,1);
  r.onupgradeneeded=()=>r.result.createObjectStore('mp3');
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
});}
async function save(key,file){const db=await openDB();try{await new Promise((resolve,reject)=>{
  const tx=db.transaction('mp3','readwrite');tx.objectStore('mp3').put(file,key);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
});}finally{db.close();}}
async function restore(){try{const db=await openDB();
  for(const key of ['wedding','credits']){
    const file=await new Promise((resolve,reject)=>{
      const r=db.transaction('mp3','readonly').objectStore('mp3').get(key);
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
    if(file){local[key]=URL.createObjectURL(file);load(key);}
  }db.close();
}catch(_){}}
function load(key){const track=tracks[key],src=local[key]||urls[key];
  if(track.dataset.current===src)return track;
  track.pause();track.dataset.current=src;track.src=src;track.preload='auto';
  return track;
}
function stop(key){const t=tracks[key];t.pause();try{t.currentTime=0;}catch(_){}}
function notify(message){let t=document.getElementById('toast');if(t){t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3600);}}
function play(key,time=0,rate=1){const t=load(key);t.playbackRate=rate;
  try{t.currentTime=time;}catch(_){}
  t.play().catch(()=>notify('Не удалось воспроизвести MP3. Проверьте файл и нажмите запуск ещё раз.'));
}
function picker(key){
  const label=document.createElement('label');label.className='secondary-button ceremony-mp3-picker';
  label.textContent='♫ Выбрать песню MP3';
  const input=document.createElement('input');input.type='file';input.accept='audio/mpeg,.mp3,audio/*';input.className='file-input';
  input.addEventListener('change',async()=>{
    const file=input.files&&input.files[0];if(!file)return;
    try{
      await save(key,file);
      if(local[key])URL.revokeObjectURL(local[key]);
      local[key]=URL.createObjectURL(file);load(key);
      const note=label.closest('.ceremony-soundbar')?.querySelector('.ceremony-sound-note');
      if(note)note.textContent='Песня сохранена на этом устройстве';
      notify('MP3 сохранён в браузере этого устройства, в том числе после обновления страницы.');
    }catch(e){notify('Не удалось сохранить песню: '+e.message);}
    input.value='';
  });label.appendChild(input);return label;
}
function soundbar(key){
  const wrap=document.createElement('div');wrap.className='ceremony-soundbar';
  wrap.appendChild(picker(key));
  const note=document.createElement('span');note.className='ceremony-sound-note';
  note.textContent='MP3 также можно разместить в media/ в репозитории';
  wrap.appendChild(note);return wrap;
}
function setupWedding(){
  const video=stage.querySelector('video[data-player="wedding"]');if(!video)return;
  if(video!==attachedVideo){
    attachedVideo=video;
    video.addEventListener('play',()=>play('wedding',video.currentTime,video.playbackRate));
    video.addEventListener('pause',()=>{if(!video.ended)tracks.wedding.pause();});
    // Let the MP3 finish independently after the 30-second video ends.
    // Do not call stop here: the wedding song may last 36 seconds.
    video.addEventListener('ended',()=>{
      const t=tracks.wedding;
      if(t.paused && !t.ended) t.play().catch(()=>notify('Нажмите воспроизведение музыки ещё раз.'));
    });
    video.addEventListener('seeking',()=>{try{tracks.wedding.currentTime=video.currentTime;}catch(_){}});
    video.addEventListener('ratechange',()=>tracks.wedding.playbackRate=video.playbackRate);
    video.addEventListener('timeupdate',()=>{const t=tracks.wedding;
      if(!video.ended&&!t.paused&&Math.abs(t.currentTime-video.currentTime)>.25)try{t.currentTime=video.currentTime;}catch(_){}
    });
  }
  const panel=stage.querySelector('.ceremony-video-panel');
  if(panel&&!stage.querySelector('.ceremony-wedding-sound')){
    const bar=soundbar('wedding');bar.classList.add('ceremony-wedding-sound');
    const btn=document.createElement('button');btn.className='primary-button';btn.textContent='▶ Видео и музыка';
    btn.type='button';btn.addEventListener('click',()=>{
      if(video.ended)video.currentTime=0;
      // Begin audio in the same user gesture as video to satisfy autoplay policies.
      play('wedding',video.currentTime,video.playbackRate);
      video.play().catch(()=>{tracks.wedding.pause();notify('Проверьте файл свадебного видео.');});
    });
    bar.insertBefore(btn,bar.firstChild);panel.insertAdjacentElement('afterend',bar);
  }
}
function animations(){return [...stage.querySelectorAll('.credits-inner')].flatMap(el=>el.getAnimations());}
function pauseCreditsScroll(){animations().forEach(a=>a.pause());}
function setupCredits(){
  const controls=stage.querySelector('.credits-controls');if(!controls)return;
  if(!controls.querySelector('.ceremony-credits-sound')){
    const wrap=soundbar('credits');wrap.classList.add('ceremony-credits-sound');controls.appendChild(wrap);
    const start=document.createElement('button');start.className='primary-button ceremony-credits-start';
    start.type='button';start.textContent='▶ Запустить титры с музыкой';
    start.addEventListener('click',()=>{
      creditsStarted=true;creditsPaused=false;
      // The original restart action is kept; credits content is unchanged.
      controls.querySelector('[data-action="credits-restart"]')?.click();
      play('credits');
      start.hidden=true;
    });
    controls.insertBefore(start,controls.firstChild);
    requestAnimationFrame(()=>{if(!creditsStarted&&scene==='credits')pauseCreditsScroll();});
  }
}
function configure(){
  const next=stage.dataset.scene||'';
  if(scene!==next){
    if(scene==='wedding')stop('wedding');
    if(scene==='credits')stop('credits');
    scene=next;
    if(next==='credits'){creditsStarted=false;creditsPaused=true;}
  }
  if(next==='wedding')setupWedding();
  if(next==='credits')setupCredits();
}
const observer=new MutationObserver(()=>configure());
observer.observe(stage,{childList:true,subtree:false});
document.addEventListener('click',e=>{
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(scene!=='credits'||!creditsStarted)return;
  if(action==='credits-pause'){
    queueMicrotask(()=>{
      const text=stage.querySelector('[data-action="credits-pause"]')?.textContent||'';
      creditsPaused=text.includes('Продолжить');
      if(creditsPaused)tracks.credits.pause();
      else tracks.credits.play().catch(()=>notify('Нажмите запуск музыки ещё раз.'));
    });
  }else if(action==='credits-restart'){
    creditsPaused=false;play('credits');
  }
});
document.addEventListener('click',e=>{
  if(!e.target.closest('[data-action="ambient-open"]'))return;
  stop('wedding');stop('credits');
});
configure();restore();
})();