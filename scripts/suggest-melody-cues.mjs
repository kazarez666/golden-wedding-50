/* Suggest first-verse and first-chorus cues from synchronized lyric TIMESTAMPS.
   Does not store or print song lyrics. Results remain PROVISIONAL and must
   be validated against the actual MP3 version used on the wedding website. */
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync('data.js','utf8'),sandbox);
const songs=sandbox.window.SITE_DATA.melodies;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const simplify=s=>String(s).toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/&/g,'и')
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function parseLRC(text){
  const a=[];
  if(!text)return a;
  for(const line of text.split(/\r?\n/)){
    const m=line.match(/^\[(\d+):(\d+)(?:\.(\d+))?\]\s*(.*)/);
    if(!m)continue;
    const time=Number(m[1])*60+Number(m[2])+(Number('0.'+(m[3]||'0')));
    const words=simplify(m[4]);
    if(words.length>6)a.push({time:Math.round(time*10)/10,words});
  }
  return a.sort((x,y)=>x.time-y.time);
}
function infer(lines,duration){
  const end=Math.max(60,Number(duration)||240);
  // Verse start is the first line of the song, usually after the intro.
  const verse=lines[0]?.time??null;
  const groups=new Map();
  lines.forEach((l,i)=>{
    if(!groups.has(l.words))groups.set(l.words,[]);
    groups.get(l.words).push(i);
  });
  const candidates=[];
  for(const [words,ids] of groups){
    if(ids.length<2 || words.length<11)continue;
    for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){
      const x=ids[a],y=ids[b],t=lines[x].time,late=lines[y].time;
      if(late-t<35||t<(verse||0)+12||t>end*.65)continue;
      let consecutive=1;
      while(consecutive<6 && lines[x+consecutive]&&lines[y+consecutive]&&
        lines[x+consecutive].words===lines[y+consecutive].words &&
        lines[x+consecutive].time-lines[x+consecutive-1].time<17&&
        lines[y+consecutive].time-lines[y+consecutive-1].time<17)consecutive++;
      // Some choruses are single repeated lines or strong first lines.
      const prevalence=ids.length;
      const score=consecutive*3 + (prevalence>=3?2:0) + (t>24?1:0) - t/170;
      candidates.push({start:t,repeats:consecutive,score:Number(score.toFixed(2)),late});
    }
  }
  candidates.sort((a,b)=>b.score-a.score||a.start-b.start);
  const firstGroups=candidates.filter(c=>c.start>=Math.max(verse||0,18));
  const top=firstGroups.slice(0,4).map(c=>({time:c.start,matchedLines:c.repeats}));
  return {verseStart:verse, chorusCandidates:top, confidence:top[0]?.matchedLines>=3?'medium':top[0]?.matchedLines===2?'low':'none'};
}
function scoreMatch(song,x){
  const title=simplify(song.song||''), artist=simplify(song.artist);
  const t=simplify(x.trackName||x.name||''), a=simplify(x.artistName||'');
  let score=0;
  if(t===title)score+=7;
  else if(t.includes(title) || title.includes(t))score+=3;
  if(a===artist)score+=6;
  else if(a.includes(artist)||artist.includes(a))score+=4;
  else if(artist.split(' ').some(w=>w.length>3&&a.includes(w)))score+=2;
  if(x.syncedLyrics)score+=2;
  if(Number(x.duration)>90)score+=1;
  return score;
}
for(let i=0;i<songs.length;i++){
  const song=songs[i];
  if(!song.song){console.log(JSON.stringify({slot:i+1,artist:song.artist,status:'missing_song_title'}));continue;}
  try{
    const params=new URLSearchParams({track_name:song.song,artist_name:song.artist});
    const response=await fetch('https://lrclib.net/api/search?'+params,
      {headers:{'User-Agent':'GoldenWeddingCueAudit/1.0 (family musical quiz)'},
       signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error('lrclib_'+response.status);
    const results=await response.json();
    const ranked=(Array.isArray(results)?results:[]).map(x=>({x,score:scoreMatch(song,x)}))
      .sort((a,b)=>b.score-a.score);
    let best=ranked.find(r=>r.x.syncedLyrics&&r.score>=8);
    if(!best){
      // A broader search sometimes finds a different transliteration.
      const q=await fetch('https://lrclib.net/api/search?q='+encodeURIComponent(song.song),
        {headers:{'User-Agent':'GoldenWeddingCueAudit/1.0 (family musical quiz)'},
         signal:AbortSignal.timeout(12000)});
      if(q.ok){
        const broad=await q.json();
        const more=(Array.isArray(broad)?broad:[]).map(x=>({x,score:scoreMatch(song,x)}))
          .sort((a,b)=>b.score-a.score);
        best=more.find(r=>r.x.syncedLyrics&&r.score>=8);
      }
    }
    if(!best){
      console.log(JSON.stringify({slot:i+1,artist:song.artist,song:song.song,status:'no_matching_synced_lyrics',matches:ranked.slice(0,2).map(r=>({name:r.x.trackName,artist:r.x.artistName,score:r.score}))}));
      continue;
    }
    const lines=parseLRC(best.x.syncedLyrics),hyp=infer(lines,best.x.duration);
    console.log(JSON.stringify({slot:i+1,artist:song.artist,song:song.song,status:'candidate',record:{id:best.x.id,trackName:best.x.trackName,artistName:best.x.artistName,duration:best.x.duration,matchScore:best.score,lines:lines.length},...hyp}));
  }catch(e){
    console.log(JSON.stringify({slot:i+1,artist:song.artist,song:song.song,status:'lookup_error',error:String(e.message).slice(0,120)}));
  }
  await sleep(600);
}
