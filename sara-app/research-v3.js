// Shared school research with cache-first persistence.
// If SARA_SHARED_RESEARCH_URL is configured, all users share the same Supabase cache.
// If it is blank/unavailable, the app falls back to the existing local browser cache.
(() => {
  const LOCAL_KEY = 'sara-school-research-v3';
  const SHARED_URL = (window.SARA_SHARED_RESEARCH_URL || '').trim();
  const baseOpenSchool = openSchool;

  function readLocal(){ try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||'{}')}catch{return {}} }
  function writeLocal(x){ try{localStorage.setItem(LOCAL_KEY,JSON.stringify(x))}catch{} }
  function inchesToHeight(n){ return Number.isFinite(n)?`${Math.floor(n/12)}'${n%12}\"`:null }
  function applyRecord(d, rec){
    if(!rec)return;
    if(rec.setter){
      const s=rec.setter;
      if(s.setter_range)d.setter_range=s.setter_range;
      if(Number.isFinite(s.minHeightInches))d.setter_min_inches=s.minHeightInches;
      if(s.summary)d.setter_note=s.summary;
      d.setter_evidence=s.evidence||'shared official research';
      if(s.pageUrl)d.roster_source=s.pageUrl;
      d.setter_checked_at=s.checkedAt||s.checked_at||null;
      d.setter_expires_at=s.expiresAt||s.expires_at||null;
    }
    if(rec.aid){
      const a=rec.aid;
      if(a.category)d.aid_category=a.category;
      if(a.summary)d.aid_note=a.summary;
      if(a.sourceUrl)d.aid_source=a.sourceUrl;
      d.aid_checked_at=a.checkedAt||a.checked_at||null;
      d.aid_expires_at=a.expiresAt||a.expires_at||null;
    }
  }
  function saveLocal(d,type,value){
    const cache=readLocal(); cache[d.key]=cache[d.key]||{}; cache[d.key][type]=value; writeLocal(cache); applyRecord(d,cache[d.key]);
  }
  function normalizeSetter(p,meta={}){
    const setters=Array.isArray(p?.setters)?p.setters.filter(x=>x&&x.name):[];
    let min=Number.isFinite(+p?.minHeightInches)?+p.minHeightInches:null;
    let max=Number.isFinite(+p?.maxHeightInches)?+p.maxHeightInches:null;
    if(min===0)min=null;if(max===0)max=null;
    if((min==null||max==null)&&setters.length){const vals=setters.map(x=>+x.heightInches).filter(Number.isFinite);if(vals.length){min=Math.min(...vals);max=Math.max(...vals)}}
    let range='Researched — height not established';
    if(min!=null&&max!=null)range=min===max?inchesToHeight(min):`${inchesToHeight(min)}–${inchesToHeight(max)}`;
    const rosterList=setters.length?setters.map(x=>`${x.name} (${x.position||'S'}, ${x.height||inchesToHeight(+x.heightInches)||'height not listed'})`).join('; '):'';
    const summary=[p?.summary,rosterList?`Official roster setters found: ${rosterList}.`:null,p?.season?`Roster season: ${p.season}.`:null].filter(Boolean).join(' ');
    return {pageUrl:p?.pageUrl||meta.sourceUrl||'',season:p?.season||'',setters,minHeightInches:min,maxHeightInches:max,setter_range:range,summary,evidence:'shared official research',checkedAt:meta.checkedAt||new Date().toISOString(),expiresAt:meta.expiresAt||null};
  }
  function normalizeAid(p,meta={}){
    const allowed=['Full need / need-blind','Full need / need-aware','Need-based available / limited','Merit only','No institutional aid identified','Unclear'];
    return {sourceUrl:p?.sourceUrl||meta.sourceUrl||'',category:allowed.includes(p?.category)?p.category:'Unclear',needBlind:p?.needBlind??null,meetsFullNeed:p?.meetsFullNeed??null,needBasedAvailable:p?.needBasedAvailable??null,meritAvailable:p?.meritAvailable??null,summary:p?.summary||'Official international-aid policy researched; the returned policy summary was incomplete.',checkedAt:meta.checkedAt||new Date().toISOString(),expiresAt:meta.expiresAt||null};
  }
  async function askLocal(prompt){
    const res=await fetch(WORKER,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})});
    if(!res.ok)throw new Error(`Research service error ${res.status}`);
    const raw=await res.json();const parts=raw?.candidates?.[0]?.content?.parts||[];const parsed=extractJson(parts.map(p=>p.text||'').join(' '));
    if(!parsed)throw new Error('The research service did not return usable structured data.');return parsed;
  }
  function setterPrompt(d){return `Research the CURRENT or MOST RECENT OFFICIAL women's volleyball roster for ${d.name}.
Use ONLY the university's official athletics website as the roster source. Identify every player whose listed position includes Setter, S, S/RS, S/OPP, or equivalent. Extract full name, class/year, position and exact listed height. Use the most recent official roster if a 2026/current roster is unavailable. Never infer missing heights.
Return ONLY JSON: {"pageUrl":"https://official-roster-url","season":"2026 or latest year","setters":[{"name":"","classYear":"","position":"","height":"5'7\\\"","heightInches":67}],"minHeightInches":67,"maxHeightInches":70,"summary":"Concise factual explanation for a 1.71 m / 5'7¼ setter."}. Never invent data.`}
  function aidPrompt(d){return `Research undergraduate financial aid for INTERNATIONAL applicants at ${d.name} using ONLY official university admissions and financial-aid webpages. Determine need-based availability, need-blind vs need-aware, whether 100% demonstrated need is met, merit availability, and material limitations.
Return ONLY JSON: {"sourceUrl":"https://official-university-url","category":"Full need / need-blind|Full need / need-aware|Need-based available / limited|Merit only|No institutional aid identified|Unclear","needBlind":true,"meetsFullNeed":true,"needBasedAvailable":true,"meritAvailable":false,"summary":"2–5 sentence precise explanation."}. If ambiguous, use Unclear.`}

  async function sharedCall(body){
    const res=await fetch(SHARED_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!res.ok){let msg=`Shared cache error ${res.status}`;try{const j=await res.json();if(j?.error)msg=j.error}catch{}throw new Error(msg)}
    return await res.json();
  }
  async function researchType(d,type,force=false){
    if(SHARED_URL){
      const r=await sharedCall({schoolKey:d.key,schoolName:d.name,type,force});
      if(!r?.payload)throw new Error('No research payload returned');
      const meta={checkedAt:r.checkedAt,expiresAt:r.expiresAt,sourceUrl:r.sourceUrl};
      return {value:type==='setter'?normalizeSetter(r.payload,meta):normalizeAid(r.payload,meta),cached:!!r.cached,shared:true};
    }
    const p=await askLocal(type==='setter'?setterPrompt(d):aidPrompt(d));
    return {value:type==='setter'?normalizeSetter(p):normalizeAid(p),cached:false,shared:false};
  }
  async function preloadShared(){
    if(!SHARED_URL)return;
    try{
      const r=await sharedCall({action:'list'});const grouped={};
      (r.rows||[]).forEach(row=>{
        grouped[row.school_key]=grouped[row.school_key]||{};
        const meta={checkedAt:row.checked_at,expiresAt:row.expires_at,sourceUrl:row.source_url};
        grouped[row.school_key][row.research_type]=row.research_type==='setter'?normalizeSetter(row.payload,meta):normalizeAid(row.payload,meta);
      });
      DATA.forEach(d=>{if(grouped[d.key]){applyRecord(d,grouped[d.key]);const local=readLocal();local[d.key]={...(local[d.key]||{}),...grouped[d.key]};writeLocal(local)}});
      const aid=document.getElementById('aid');if(aid)aid.dispatchEvent(new Event('change',{bubbles:true}));else renderAll();
    }catch(e){console.warn('Shared research cache preload failed; local fallback remains available.',e)}
  }
  function rerender(){const aid=document.getElementById('aid');if(aid)aid.dispatchEvent(new Event('change',{bubbles:true}));else renderAll()}
  function status(msg,isError=false){const el=document.getElementById('schoolResearchStatus');if(!el)return;el.textContent=msg;el.style.display='block';el.style.background=isError?'#fff0ee':'#eef5f4';el.style.color=isError?'#9a3328':'#0b5d56'}
  function disable(v){['researchSetter','researchAid','researchBoth','refreshSetter','refreshAid'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=v})}
  function dateText(v){if(!v)return '';try{return new Date(v).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}catch{return ''}}
  function appendControls(d){
    const host=document.getElementById('dContent');if(!host)return;
    const shared=!!SHARED_URL;
    const box=document.createElement('div');box.className='detailBox';box.style.marginTop='10px';
    box.innerHTML=`<h4>Research missing / outdated data</h4>
      <div class="small" style="margin-bottom:9px">${shared?'Shared cache is active. Existing research is reused for every visitor; the AI research service is called only when no fresh shared result exists or when Refresh is explicitly used.':'Shared backend is not connected yet; research currently falls back to this browser only.'}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="researchBoth" class="action primary">Research setter + international aid</button>
        <button id="researchSetter" class="action">Research setter heights</button>
        <button id="researchAid" class="action">Research international aid</button>
        ${shared?'<button id="refreshSetter" class="action">Refresh setter research</button><button id="refreshAid" class="action">Refresh aid research</button>':''}
      </div>
      <div id="schoolResearchStatus" class="status"></div>
      <div class="small" style="margin-top:8px">Setter last checked: ${dateText(d.setter_checked_at)||'—'} · Aid last checked: ${dateText(d.aid_checked_at)||'—'}</div>`;
    host.appendChild(box);
    const run=async(type,force=false)=>{status(`${force?'Refreshing':'Checking'} ${type==='setter'?'setter-height evidence':'international financial aid'}…`);disable(true);try{const r=await researchType(d,type,force);saveLocal(d,type,r.value);rerender();openSchool(d.key);status(r.cached&&!force?'Loaded from shared cache — no new AI research used.':`${type==='setter'?'Setter':'Aid'} research completed and saved${r.shared?' to the shared database':' on this device'}.`)}catch(e){status(`${type==='setter'?'Setter':'Aid'} research failed: ${e.message}`,true)}finally{disable(false)}};
    document.getElementById('researchSetter').onclick=()=>run('setter',false);
    document.getElementById('researchAid').onclick=()=>run('aid',false);
    document.getElementById('researchBoth').onclick=async()=>{disable(true);status('Checking shared cache for setter and aid research…');let errors=[];try{for(const type of ['setter','aid']){try{const r=await researchType(d,type,false);saveLocal(d,type,r.value)}catch(e){errors.push(`${type}: ${e.message}`)}}rerender();openSchool(d.key);status(errors.length?`Finished with an issue: ${errors.join('; ')}`:`Both research tasks are available${SHARED_URL?' in the shared database':''}.`,!!errors.length)}finally{disable(false)}};
    const rs=document.getElementById('refreshSetter');if(rs)rs.onclick=()=>run('setter',true);
    const ra=document.getElementById('refreshAid');if(ra)ra.onclick=()=>run('aid',true);
  }

  const local=readLocal();DATA.forEach(d=>applyRecord(d,local[d.key]));
  openSchool=function(key){baseOpenSchool(key);const d=DATA.find(x=>x.key===key);if(d)appendControls(d)};
  preloadShared();
})();
