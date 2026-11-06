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


// Confirm the exact Kobzon record rather than mistakenly using the Murakami cover.
const ids=[
  {slot:5,id:38565012},
  {slot:5,id:37391915},
  {slot:20,id:39882004},
  {slot:20,id:14082378},
  {slot:20,id:14082376}
];
const norm=x=>String(x).toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
for(const item of ids){
  try{
    const res=await fetch('https://lrclib.net/api/get/'+item.id,{
      headers:{'User-Agent':'GoldenWeddingCueAudit/1.1 (family musical quiz)'},
      signal:AbortSignal.timeout(10000)});
    if(!res.ok){console.log(JSON.stringify({recordId:item.id,status:res.status}));continue;}
    const x=await res.json();
    const lines=String(x.syncedLyrics||'').split('\n').map(row=>{
      const m=row.match(/^\[(\d+):(\d+)(?:\.(\d+))?\]\s*(.*)/);
      return m?{t:Number(m[1])*60+Number(m[2])+Number('0.'+(m[3]||'0')),v:norm(m[4])}:null;
    }).filter(x=>x?.v.length>10);
    const duplicates=[];
    for(let a=0;a<lines.length;a++){
      for(let b=a+1;b<lines.length;b++){
        if(lines[b].t-lines[a].t<38||lines[a].v!==lines[b].v)continue;
        let count=1;
        while(lines[a+count]&&lines[b+count]&&lines[a+count].v===lines[b+count].v)count++;
        if(lines[a].t>15)duplicates.push({start:+lines[a].t.toFixed(1),count,reappears:+lines[b].t.toFixed(1)});
      }
    }
    duplicates.sort((a,b)=>b.count-a.count || a.start-b.start);
    console.log(JSON.stringify({recordId:item.id,slot:item.slot,artist:x.artistName,name:x.trackName,duration:x.duration,verseStart:lines[0]?.t??null,firstLines:lines.slice(0,12).map(y=>+y.t.toFixed(1)),candidates:duplicates.slice(0,7)}));
  }catch(e){console.log(JSON.stringify({recordId:item.id,error:String(e.message)}));}
  await sleep(600);
}
