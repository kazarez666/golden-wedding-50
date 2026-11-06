// Diagnostics for the public song collection; no Cloudinary secrets.
const cloud='t8dsuxni',tag='golden_wedding_50_family_2026';
const url='https://res.cloudinary.com/'+cloud+'/video/list/'+tag+'.json?audit='+Date.now();
const r=await fetch(url,{signal:AbortSignal.timeout(15000)});
if(!r.ok)throw Error('Manifest HTTP '+r.status);
const j=await r.json();
const assets=(j.resources||[]).filter(a=>(a.context?.custom?.slot||a.context?.slot||'').startsWith('melody-'));
console.log('TOTAL_CLOUD_MELODIES',assets.length);
for(let slot=0;slot<20;slot++){
  const matches=assets.filter(a=>(a.context?.custom?.slot||a.context?.slot)==='melody-'+slot);
  if(matches.length===0){console.log('SLOT',slot,'MISSING');continue;}
  for(const a of matches){
    const u=a.secure_url || ('https://res.cloudinary.com/'+cloud+'/video/upload/v'+a.version+'/'+a.public_id+'.'+a.format);
    let response='';
    try{
      const head=await fetch(u,{method:'HEAD',signal:AbortSignal.timeout(13000)});
      response='HTTP_'+head.status+' MIME_'+head.headers.get('content-type')+' SIZE_'+head.headers.get('content-length');
    }catch(e){response='HEAD_FAILED_'+String(e.message).slice(0,100)}
    console.log('SLOT',slot,'ASSET',JSON.stringify({public_id:a.public_id,version:a.version,format:a.format,status:response}));
  }
}