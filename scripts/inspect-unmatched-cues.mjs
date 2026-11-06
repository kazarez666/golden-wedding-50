// Supplementary lookup for the missing or mismatched performances.
const groups={
  5:['Иосиф Кобзон Мгновения','Кобзон Мгновения','Мгновения',
    'Мгновенья Кобзон','Не думай о секундах свысока'],
  7:['Тамара Синявская Гляжу в озёра синие','Гляжу в озера синие','Гляжу в озёра синие'],
  11:['Поющие гитары Люди встречаются','Люди встречаются','Весёлые ребята Люди встречаются'],
  12:['Hi-Fi А мы любили','А мы любили Hi Fi','А мы любили'],
  20:['Сергей Никитин Я спросил у ясеня','Я спросил у ясеня Сергей Никитин']
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(const [n,qs] of Object.entries(groups)){
  const found=new Map();
  for(const query of qs){
    try{
      const res=await fetch('https://lrclib.net/api/search?q='+encodeURIComponent(query),{
        headers:{'User-Agent':'GoldenWeddingCueAudit/1.1 (family musical quiz)'},
        signal:AbortSignal.timeout(9000)});
      if(!res.ok){console.log(JSON.stringify({slot:n,query,status:res.status}));continue;}
      const a=await res.json();
      for(const x of (Array.isArray(a)?a:[])){
        if(found.has(x.id))continue;
        found.set(x.id,{name:x.trackName,artist:x.artistName,duration:x.duration,synced:!!x.syncedLyrics,id:x.id});
      }
    }catch(err){console.log(JSON.stringify({slot:n,query,error:String(err.message)}));}
    await sleep(500);
  }
  const foundArray=[...found.values()];
  console.log(JSON.stringify({slot:Number(n),results:foundArray.filter(x=>x.synced).slice(0,12),noSyncCount:foundArray.filter(x=>!x.synced).length}));
}
