// Golden Wedding media backend. Cloudflare Worker + R2.
// Bind R2 as WEDDING_MEDIA; create secret ADMIN_TOKEN (24+ chars).
// Do NOT put credentials in GitHub or frontend files.
const ORIGIN='https://kazarez666.github.io';
const PART=8*1024*1024;
const valid=s=>s==='wedding'||/^interview-(?:[0-9]|1[0-5])$/.test(s);
const key=s=>'videos/'+s;
const CORS={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type,Range','Access-Control-Expose-Headers':'Content-Range,Content-Length,Accept-Ranges,ETag','Vary':'Origin'};
const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{...CORS,'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'}});
const fail=(message,status=400)=>reply({error:message},status);
export default {
 async fetch(req,env){
  try {
   const url=new URL(req.url),path=url.pathname.replace(/\/$/,'')||'/';
   if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
   if(!env.WEDDING_MEDIA)return fail('R2 binding WEDDING_MEDIA not set',503);
   if(path==='/health'&&req.method==='GET')return reply({ok:true,service:'wedding-media'});
   if(path==='/manifest'&&req.method==='GET'){
    const videos=[];let cursor;
    do{
     const list=await env.WEDDING_MEDIA.list({prefix:'videos/',limit:100,...(cursor?{cursor}:{})});
     for(const item of list.objects){
      const slot=item.key.slice(7);
      if(valid(slot))videos.push({slot,size:item.size,version:item.etag||String(item.size),updatedAt:item.uploaded?.toISOString?.()||null});
     }
     cursor=list.truncated?list.cursor:undefined;
    }while(cursor);
    return reply({videos});
   }
   if(path.startsWith('/media/')&&req.method==='GET'){
    const slot=path.slice(7);
    if(!valid(slot))return fail('Unknown video',404);
    const ranged=req.headers.has('Range');
    const obj=await env.WEDDING_MEDIA.get(key(slot),ranged?{range:req.headers}:undefined);
    if(!obj)return fail('Video not uploaded',404);
    if(!obj.body)return fail('Invalid range',416);
    const h=new Headers(CORS);obj.writeHttpMetadata(h);
    h.set('Content-Type',obj.httpMetadata?.contentType||'video/mp4');
    h.set('Accept-Ranges','bytes');h.set('ETag',obj.httpEtag);h.set('Cache-Control','public,max-age=3600');
    if(ranged&&obj.range&&Number.isInteger(obj.range.offset)&&Number.isInteger(obj.range.length)){
     const start=obj.range.offset,end=start+obj.range.length-1;
     h.set('Content-Range','bytes '+start+'-'+end+'/'+obj.size);
     h.set('Content-Length',String(obj.range.length));
     return new Response(obj.body,{status:206,headers:h});
    }
    h.set('Content-Length',String(obj.size));return new Response(obj.body,{headers:h});
   }
   if(!path.startsWith('/upload/'))return fail('Not found',404);
   if(!['PUT','POST'].includes(req.method))return fail('Method not allowed',405);
   if(req.headers.get('Origin')&&req.headers.get('Origin')!==ORIGIN)return fail('Origin not allowed',403);
   if(!env.ADMIN_TOKEN||env.ADMIN_TOKEN.length<24||req.headers.get('Authorization')!=='Bearer '+env.ADMIN_TOKEN)return fail('Wrong administrator code',401);
   const action=path.slice(8);
   if(action==='start'&&req.method==='POST'){
    const body=await req.json();
    if(!valid(body.slot))return fail('Invalid slot');
    if(!Number.isSafeInteger(body.size)||body.size<1||body.size>5*1024**3)return fail('Video is too large');
    if(!['video/mp4','video/webm','video/quicktime','video/x-m4v'].includes(body.type))return fail('Unsupported video format',415);
    const upload=await env.WEDDING_MEDIA.createMultipartUpload(key(body.slot),{httpMetadata:{contentType:body.type}});
    return reply({uploadId:upload.uploadId,slot:body.slot,partSize:PART});
   }
   const slot=url.searchParams.get('slot'),id=url.searchParams.get('uploadId');
   if(!valid(slot)||!id||id.length>200)return fail('Missing upload information');
   const upload=env.WEDDING_MEDIA.resumeMultipartUpload(key(slot),id);
   if(action==='part'&&req.method==='PUT'){
    const n=Number(url.searchParams.get('partNumber'));
    if(!Number.isInteger(n)||n<1||n>10000)return fail('Invalid part');
    if(Number(req.headers.get('Content-Length')||0)>PART)return fail('Part is too large',413);
    const bytes=await req.arrayBuffer();
    if(bytes.byteLength<1||bytes.byteLength>PART)return fail('Invalid part size',413);
    return reply(await upload.uploadPart(n,bytes));
   }
   if(action==='complete'&&req.method==='POST'){
    const {parts}=await req.json();
    if(!Array.isArray(parts)||parts.length<1||parts.length>10000||parts.some((p,i)=>p?.partNumber!==i+1||!/^[0-9a-f]{32}$/i.test(p.etag||'')))return fail('Invalid parts');
    const obj=await upload.complete(parts);
    return reply({ok:true,slot,size:obj.size,version:obj.etag});
   }
   if(action==='abort'&&req.method==='POST'){await upload.abort();return reply({ok:true})}
   return fail('Unknown action',404);
  }catch(error){console.error(error);return fail('Media service error',500)}
 }
};