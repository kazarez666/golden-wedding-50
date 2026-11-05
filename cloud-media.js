/* Golden Wedding cloud video client. No admin secrets are persisted. */
(() => {
  'use strict';
  const cfg=window.WEDDING_MEDIA_CONFIG||{};
  const endpoint=String(cfg.workerUrl||'').trim().replace(/\/+$/,'');
  const configured=/^https:\/\/[\w.-]+(?::\d+)?$/.test(endpoint);
  const isVideo=k=>k==='wedding'||/^interview-(?:[0-9]|1[0-5])$/.test(k);
  let admin='', busy=false, videos=new Map();
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function setupUI(){
    let el=document.getElementById('cloud-upload-status');
    if(el)return el;
    el=document.createElement('div');el.id='cloud-upload-status';el.hidden=true;
    el.innerHTML='<div class="cloud-uploader"><div class="cloud-symbol">☁</div><h2>Загрузка видео</h2><p class="cloud-filename"></p><div class="cloud-track"><div class="cloud-fill"></div></div><p class="cloud-message">Начинаем загрузку…</p><small>Не закрывайте страницу, пока загрузка не закончится.</small><button type="button" class="cloud-cancel">Отменить загрузку</button></div>';
    document.body.appendChild(el);
    return el;
  }
  function progress(message,part){
    const el=setupUI();el.hidden=false;
    el.querySelector('.cloud-message').textContent=message;
    el.querySelector('.cloud-fill').style.width=Math.max(0,Math.min(100,part))+'%';
  }
  async function refresh(){
    if(!configured||busy)return false;
    try{
      const r=await fetch(endpoint+'/manifest',{cache:'no-store'});
      if(!r.ok)throw new Error('Ошибка хранилища '+r.status);
      const d=await r.json();if(!Array.isArray(d.videos))throw new Error('Неверный ответ сервера');
      const next=new Map(d.videos.filter(x=>isVideo(x.slot)).map(x=>[x.slot,x]));
      const changed=JSON.stringify([...next])!==JSON.stringify([...videos]);
      videos=next;
      if(changed)document.dispatchEvent(new Event('wedding-cloud-updated'));
      return true;
    }catch(e){console.warn('Видео не синхронизировались:',e);return false}
  }
  function fileURL(slot,fallback){
    if(!configured||!isVideo(slot)||!videos.has(slot))return fallback;
    const obj=videos.get(slot);
    return endpoint+'/media/'+encodeURIComponent(slot)+'?v='+encodeURIComponent(obj.version||obj.updatedAt||'');
  }
  async function api(path,options={},signal){
    const r=await fetch(endpoint+path,{...options,signal,headers:{Authorization:'Bearer '+admin,...(options.headers||{})}});
    const result=await r.json().catch(()=>({}));
    if(!r.ok){
      if(r.status===401)admin='';
      throw new Error(result.error||('Ошибка сервера '+r.status));
    }
    return result;
  }
  async function upload(slot,file){
    if(!configured)throw new Error('Облачное хранилище ещё не подключено. Файл будет виден только на этом устройстве.');
    if(!isVideo(slot))throw new Error('Облачная загрузка для этого файла пока недоступна.');
    if(busy)throw new Error('Сначала дождитесь окончания предыдущей загрузки.');
    if(!file?.size)throw new Error('Выбери непустой видеофайл.');
    const ext=String(file.name).split('.').pop().toLowerCase();
    const type=({mp4:'video/mp4',m4v:'video/x-m4v',mov:'video/quicktime',webm:'video/webm'})[ext];
    if(!type)throw new Error('Выбери MP4, M4V, MOV или WebM. Надёжнее всего MP4 (H.264 + AAC).');
    if(file.size>5*1024**3)throw new Error('Размер видео превышает 5 ГБ.');
    if(!admin){
      admin=prompt('Введи код администратора, который ты указал в Cloudflare:')||'';
      if(!admin)throw new Error('Загрузка отменена: код не введён.');
    }
    let started=null;const controller=new AbortController();
    const el=setupUI();el.querySelector('.cloud-filename').textContent=file.name;
    const cancel=el.querySelector('.cloud-cancel');
    cancel.disabled=false;cancel.onclick=()=>{cancel.disabled=true;controller.abort()};
    busy=true;progress('Подключаемся к хранилищу…',0);
    try{
      started=await api('/upload/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slot,size:file.size,type})},controller.signal);
      const size=started.partSize||8388608,count=Math.ceil(file.size/size),parts=[];
      for(let i=0;i<count;i++){
        if(controller.signal.aborted)throw new Error('Загрузка отменена');
        const chunk=file.slice(i*size,Math.min((i+1)*size,file.size));
        let part;
        for(let attempt=0;attempt<3;attempt++){
          try{
            part=await api('/upload/part?slot='+encodeURIComponent(slot)+'&uploadId='+encodeURIComponent(started.uploadId)+'&partNumber='+(i+1),{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:chunk},controller.signal);
            break;
          }catch(e){
            if(controller.signal.aborted||attempt===2||!admin)throw e;
            progress('Проблема с сетью, повторяем часть '+(i+1)+'…',Math.floor(i/count*100));
            await sleep((attempt+1)*800);
          }
        }
        parts.push({partNumber:part.partNumber,etag:part.etag});
        const percent=Math.round((i+1)/count*100);
        progress('Загружено '+percent+'% · часть '+(i+1)+' из '+count,percent);
      }
      progress('Сохраняем видео для всех устройств…',100);
      await api('/upload/complete?slot='+encodeURIComponent(slot)+'&uploadId='+encodeURIComponent(started.uploadId),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({parts})},controller.signal);
      busy=false;await refresh();
      progress('Готово! Видео доступно на всех устройствах.',100);
      await sleep(900);
      return true;
    }catch(e){
      if(started)api('/upload/abort?slot='+encodeURIComponent(slot)+'&uploadId='+encodeURIComponent(started.uploadId),{method:'POST'}).catch(()=>{});
      if(controller.signal.aborted)throw new Error('Загрузка отменена.');
      throw e;
    }finally{busy=false;el.hidden=true;cancel.onclick=null}
  }
  window.WeddingCloud={ready:()=>configured,fileURL,refresh,upload,isVideo,
    statusLabel:()=>configured?'☁ Видео сохранится в облаке и появится на других устройствах.':'⚠ Облако не подключено: пока не загружайте видео, сначала завершите настройку хранилища.'};
  if(configured){
    document.addEventListener('DOMContentLoaded',()=>{
      refresh();setInterval(()=>{if(!document.hidden)refresh()},30000);
    });
  }
})();
