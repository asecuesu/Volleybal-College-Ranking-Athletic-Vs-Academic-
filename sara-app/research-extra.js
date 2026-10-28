// Supplemental centralized research for expanded-universe fields.
(() => {
  const LOCAL_KEY = 'sara-school-research-v3';
  const SHARED_URL = (window.SARA_SHARED_RESEARCH_URL || '').trim();
  if (!SHARED_URL) return;

  function readLocal(){ try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||'{}')}catch{return {}} }
  function writeLocal(x){ try{localStorage.setItem(LOCAL_KEY,JSON.stringify(x))}catch{} }
  async function sharedCall(body){
    const res=await fetch(SHARED_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!res.ok){let msg='Shared cache error '+res.status;try{const j=await res.json();if(j&&j.error)msg=j.error}catch{}throw new Error(msg)}
    return await res.json();
  }
  function normalizeAthletic(p,meta){
    meta=meta||{};
    const fits=['Strong','Good','Reach'];
    const cw=Number.isFinite(+p.conferenceWins)?+p.conferenceWins:null;
    const cl=Number.isFinite(+p.conferenceLosses)?+p.conferenceLosses:null;
    const ow=Number.isFinite(+p.overallWins)?+p.overallWins:null;
    const ol=Number.isFinite(+p.overallLosses)?+p.overallLosses:null;
    let strength=null;
    if(cw!=null&&cl!=null&&(cw+cl)>0)strength=Math.round(100*cw/(cw+cl));
    else if(ow!=null&&ol!=null&&(ow+ol)>0)strength=Math.round(100*ow/(ow+ol));
    let record='Researched; official record incomplete';
    if(cw!=null&&cl!=null)record=cw+'–'+cl+' conference'+(ow!=null&&ol!=null?'; '+ow+'–'+ol+' overall':'')+' ('+(p.season||'latest')+')';
    else if(ow!=null&&ol!=null)record=ow+'–'+ol+' overall ('+(p.season||'latest')+')';
    return {
      sourceUrl:p.sourceUrl||meta.sourceUrl||'',
      season:p.season||'',
      conference:p.conference||'',
      overallWins:ow,overallLosses:ol,conferenceWins:cw,conferenceLosses:cl,
      conferenceFinish:p.conferenceFinish||'',postseason:p.postseason||'',
      setters:Array.isArray(p.setters)?p.setters:[],
      athletic_fit:fits.includes(p.athleticFit)?p.athleticFit:'Unassessed',
      vb_strength:strength,recordText:record,
      fitRationale:p.fitRationale||'',summary:p.summary||'',
      checkedAt:meta.checkedAt||new Date().toISOString(),expiresAt:meta.expiresAt||null
    };
  }
  function normalizeAid(p,meta){
    meta=meta||{};
    const allowed=['Full need / need-blind','Full need / need-aware','Need-based available / limited','Merit only','No institutional aid identified','Unclear'];
    return {sourceUrl:p.sourceUrl||meta.sourceUrl||'',category:allowed.includes(p.category)?p.category:'Unclear',needBlind:p.needBlind??null,meetsFullNeed:p.meetsFullNeed??null,needBasedAvailable:p.needBasedAvailable??null,meritAvailable:p.meritAvailable??null,summary:p.summary||'Official international-aid policy researched; returned policy was incomplete.',checkedAt:meta.checkedAt||new Date().toISOString(),expiresAt:meta.expiresAt||null};
  }
  function applyValue(d,type,v){
    if(type==='athletic'){
      if(v.athletic_fit)d.athletic_fit=v.athletic_fit;
      if(Number.isFinite(v.vb_strength))d.vb_strength=v.vb_strength;
      if(v.recordText)d.record_2025=v.recordText;
      if(v.conference)d.conference=v.conference;
      d.athletic_note=v.fitRationale||v.summary||'';
      d.athletic_source=v.sourceUrl||'';
      d.athletic_checked_at=v.checkedAt||null;
      d.athletic_expires_at=v.expiresAt||null;
    } else if(type==='aid'){
      if(v.category)d.aid_category=v.category;
      if(v.summary)d.aid_note=v.summary;
      if(v.sourceUrl)d.aid_source=v.sourceUrl;
      d.aid_checked_at=v.checkedAt||null;
      d.aid_expires_at=v.expiresAt||null;
    }
  }
  function saveValue(d,type,v){
    const cache=readLocal();
    cache[d.key]=cache[d.key]||{};
    cache[d.key][type]=v;
    writeLocal(cache);
    applyValue(d,type,v);
  }
  async function research(d,type){
    const r=await sharedCall({schoolKey:d.key,schoolName:d.name,type:type,force:false});
    if(!r||!r.payload)throw new Error('No research payload returned');
    const meta={checkedAt:r.checkedAt,expiresAt:r.expiresAt,sourceUrl:r.sourceUrl};
    return type==='athletic'?normalizeAthletic(r.payload,meta):normalizeAid(r.payload,meta);
  }
  function rerender(){
    const aid=document.getElementById('aid');
    if(aid)aid.dispatchEvent(new Event('change',{bubbles:true}));
    else if(typeof renderAll==='function')renderAll();
    updateCounts();
  }
  function relevantAid(d){return d.division==='D3'||d.athletic_scholarships===false}
  function missingAthletic(d){return !d.athletic_fit||d.athletic_fit==='Unassessed'}
  function missingAid(d){return relevantAid(d)&&(!d.aid_category||d.aid_category==='Not researched')}
  function updateCounts(){
    const el=document.getElementById('coreResearchCounts');
    if(!el)return;
    const athletic=DATA.filter(missingAthletic).length;
    const aid=DATA.filter(missingAid).length;
    el.textContent=athletic+' schools missing athletic-fit research · '+aid+' relevant schools missing international-aid research.';
  }
  async function runBatch(type,keys,onProgress){
    const list=[...new Set(keys||[])];
    let completed=0,failed=0;
    for(let i=0;i<list.length;i++){
      const d=DATA.find(x=>x.key===list[i]);
      if(!d){failed++;continue}
      try{
        if(onProgress)onProgress(i,list.length,d.name);
        const v=await research(d,type);
        saveValue(d,type,v);
        completed++;
      }catch(e){
        failed++;
        if(onProgress)onProgress(i+1,list.length,d.name+' — failed');
      }
    }
    rerender();
    return {completed:completed,failed:failed,total:list.length};
  }
  window.SARA_researchSupplementBatch=runBatch;

  function addPanel(){
    if(document.getElementById('coreResearchPanel'))return;
    const meta=document.querySelector('.filterMeta');
    if(!meta)return;
    const panel=document.createElement('div');
    panel.id='coreResearchPanel';
    panel.className='card';
    panel.style.gridColumn='1 / -1';
    panel.style.marginTop='4px';
    panel.innerHTML='<h3 style="margin:0 0 6px">Expanded-universe research</h3>'+
      '<div id="coreResearchCounts" class="small" style="margin-bottom:8px"></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
      '<button id="batchAthletic" class="action primary" type="button">Research missing athletic fit for visible schools</button>'+
      '<button id="batchAid" class="action" type="button">Research relevant aid for visible schools</button>'+
      '</div><div id="coreResearchStatus" class="small" style="margin-top:8px"></div>';
    meta.insertAdjacentElement('beforebegin',panel);
    const status=document.getElementById('coreResearchStatus');

    async function go(type){
      const candidates=(typeof filtered!=='undefined'?filtered:DATA).filter(type==='athletic'?missingAthletic:missingAid);
      if(!candidates.length){status.textContent='Nothing missing for the currently visible schools.';return}
      if(candidates.length>20&&!window.confirm('This will research '+candidates.length+' schools and may use AI/search credits for uncached schools. Continue?'))return;
      const a=document.getElementById('batchAthletic'),b=document.getElementById('batchAid');
      a.disabled=true;b.disabled=true;
      status.textContent='Starting 0 of '+candidates.length+'…';
      try{
        const result=await runBatch(type,candidates.map(x=>x.key),(done,total,name)=>{
          status.textContent='Researching '+Math.min(done+1,total)+' of '+total+'… '+name;
        });
        status.textContent='Finished: '+result.completed+' researched, '+result.failed+' failed. Results are stored centrally in Supabase.';
      }catch(e){status.textContent='Batch stopped: '+e.message}
      finally{a.disabled=false;b.disabled=false;updateCounts()}
    }
    document.getElementById('batchAthletic').onclick=()=>go('athletic');
    document.getElementById('batchAid').onclick=()=>go('aid');
    updateCounts();
  }

  async function preloadAthletic(){
    try{
      const r=await sharedCall({action:'list'});
      const local=readLocal();
      (r.rows||[]).filter(row=>row.research_type==='athletic').forEach(row=>{
        const d=DATA.find(x=>x.key===row.school_key);
        if(!d)return;
        const v=normalizeAthletic(row.payload,{checkedAt:row.checked_at,expiresAt:row.expires_at,sourceUrl:row.source_url});
        applyValue(d,'athletic',v);
        local[d.key]=local[d.key]||{};
        local[d.key].athletic=v;
      });
      writeLocal(local);
      rerender();
    }catch(e){console.warn('Athletic cache preload failed',e)}
  }

  addPanel();
  preloadAthletic();
})();