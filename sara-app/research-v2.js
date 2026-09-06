// Live school research: setter-height evidence + international financial aid.
// Reuses the same existing search worker as coach refresh. Results are cached
// in this browser and merged into the in-memory school record on future loads.
(() => {
  const CACHE_KEY = 'sara-school-research-v2';
  const baseOpenSchool = openSchool;

  function readCache(){
    try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')}catch{return {}}
  }
  function writeCache(cache){
    try{localStorage.setItem(CACHE_KEY,JSON.stringify(cache))}catch{}
  }
  function inchesToHeight(n){
    if(!Number.isFinite(n))return null;
    return `${Math.floor(n/12)}'${n%12}\"`;
  }
  function applyCachedRecord(d,rec){
    if(!rec)return;
    if(rec.setter){
      const s=rec.setter;
      if(s.setter_range)d.setter_range=s.setter_range;
      if(Number.isFinite(s.minHeightInches))d.setter_min_inches=s.minHeightInches;
      if(s.summary)d.setter_note=s.summary;
      d.setter_evidence=s.evidence||'live official research';
      if(s.pageUrl)d.roster_source=s.pageUrl;
    }
    if(rec.aid){
      const a=rec.aid;
      if(a.category)d.aid_category=a.category;
      if(a.summary)d.aid_note=a.summary;
      if(a.sourceUrl)d.aid_source=a.sourceUrl;
    }
  }
  function hydrateAll(){
    const cache=readCache();
    DATA.forEach(d=>applyCachedRecord(d,cache[d.key]));
  }
  async function ask(prompt){
    const res=await fetch(WORKER,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})});
    if(!res.ok)throw new Error(`Research service error ${res.status}`);
    const raw=await res.json();
    const parts=raw?.candidates?.[0]?.content?.parts||[];
    const parsed=extractJson(parts.map(p=>p.text||'').join(' '));
    if(!parsed)throw new Error('The research service did not return usable structured data.');
    return parsed;
  }
  async function researchSetter(d){
    const prompt=`Research the CURRENT or MOST RECENT OFFICIAL women's volleyball roster for ${d.name}.
Use ONLY the university's official athletics website as the roster source. Do not use recruiting sites, Wikipedia, social media, or third-party roster databases.
Identify every player whose listed position includes Setter, S, S/RS, S/OPP, or an equivalent setter designation. Extract the player's full name, class/year, exact listed position, and exact listed height.
If a 2026/current roster is unavailable, use the most recent official roster you can find and state the season/year clearly. Do not infer a player's height and do not convert a missing height into an estimate.
Return ONLY valid JSON in exactly this shape:
{"pageUrl":"https://official-roster-url","season":"2026 or latest year","setters":[{"name":"","classYear":"","position":"","height":"5'7\\\"","heightInches":67}],"minHeightInches":67,"maxHeightInches":70,"summary":"Concise factual explanation of what this roster evidence implies for a 1.71 m / 5'7¼ setter."}
If no setter can be identified on the official roster, return an empty setters array, null minHeightInches/maxHeightInches, and explain that limitation in summary. Never invent data.`;
    const p=await ask(prompt);
    const setters=Array.isArray(p.setters)?p.setters.filter(x=>x&&x.name):[];
    let min=Number.isFinite(+p.minHeightInches)?+p.minHeightInches:null;
    let max=Number.isFinite(+p.maxHeightInches)?+p.maxHeightInches:null;
    if(min===0)min=null;if(max===0)max=null;
    if((min==null||max==null)&&setters.length){
      const vals=setters.map(x=>+x.heightInches).filter(Number.isFinite);
      if(vals.length){min=Math.min(...vals);max=Math.max(...vals)}
    }
    let range='Researched — height not established';
    if(min!=null&&max!=null)range=min===max?inchesToHeight(min):`${inchesToHeight(min)}–${inchesToHeight(max)}`;
    const rosterList=setters.length?setters.map(x=>`${x.name} (${x.position||'S'}, ${x.height||inchesToHeight(+x.heightInches)||'height not listed'})`).join('; '):'';
    const summary=[p.summary,rosterList?`Official roster setters found: ${rosterList}.`:null,p.season?`Roster season: ${p.season}.`:null].filter(Boolean).join(' ');
    return {pageUrl:p.pageUrl||'',season:p.season||'',setters,minHeightInches:min,maxHeightInches:max,setter_range:range,summary,evidence:'live official research',checkedAt:new Date().toISOString()};
  }
  async function researchAid(d){
    const prompt=`Research undergraduate financial aid for INTERNATIONAL applicants at ${d.name} using ONLY official university admissions and financial-aid webpages.
Determine: (1) whether international applicants can receive institutional need-based aid; (2) whether admissions is need-blind or need-aware for international applicants; (3) whether the university says it meets 100% of demonstrated financial need for admitted international students; (4) whether merit scholarships are available to international applicants; and (5) any important limitation that materially affects an international applicant seeking substantial aid.
Prefer the main official international-student financial-aid page. If multiple official pages are necessary, use the strongest primary source as sourceUrl and summarize any important additional official information.
Return ONLY valid JSON in exactly this shape:
{"sourceUrl":"https://official-university-url","category":"Full need / need-blind|Full need / need-aware|Need-based available / limited|Merit only|No institutional aid identified|Unclear","needBlind":true,"meetsFullNeed":true,"needBasedAvailable":true,"meritAvailable":false,"summary":"2–5 sentence precise explanation for an international undergraduate applicant."}
Do not infer policy from U.S.-citizen aid rules. If the official policy is ambiguous, use category Unclear rather than guessing.`;
    const p=await ask(prompt);
    const allowed=['Full need / need-blind','Full need / need-aware','Need-based available / limited','Merit only','No institutional aid identified','Unclear'];
    const category=allowed.includes(p.category)?p.category:'Unclear';
    return {sourceUrl:p.sourceUrl||'',category,needBlind:p.needBlind??null,meetsFullNeed:p.meetsFullNeed??null,needBasedAvailable:p.needBasedAvailable??null,meritAvailable:p.meritAvailable??null,summary:p.summary||'Official international-aid policy researched; the returned policy summary was incomplete.',checkedAt:new Date().toISOString()};
  }
  function saveResearch(d,type,value){
    const cache=readCache();
    cache[d.key]=cache[d.key]||{};
    cache[d.key][type]=value;
    writeCache(cache);
    applyCachedRecord(d,cache[d.key]);
  }
  function rerenderForCurrentFilters(){
    const aid=document.getElementById('aid');
    if(aid)aid.dispatchEvent(new Event('change',{bubbles:true}));
    else renderAll();
  }
  function status(msg,isError=false){
    const el=document.getElementById('schoolResearchStatus');
    if(!el)return;
    el.textContent=msg;
    el.style.display='block';
    el.style.background=isError?'#fff0ee':'#eef5f4';
    el.style.color=isError?'#9a3328':'#0b5d56';
  }
  function setResearchButtonsDisabled(disabled){
    ['researchSetter','researchAid','researchBoth'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=disabled});
  }
  function appendResearchControls(d){
    const host=document.getElementById('dContent');
    if(!host)return;
    const box=document.createElement('div');
    box.className='detailBox';
    box.style.marginTop='10px';
    box.innerHTML=`<h4>Research missing / outdated data</h4>
      <div class="small" style="margin-bottom:9px">Uses the same live research service as coach refresh. Setter research is restricted to the school's official athletics roster; aid research is restricted to official admissions / financial-aid pages.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="researchBoth" class="action primary">Research setter + international aid</button>
        <button id="researchSetter" class="action">Research setter heights</button>
        <button id="researchAid" class="action">Research international aid</button>
      </div>
      <div id="schoolResearchStatus" class="status"></div>
      <div class="small" style="margin-top:8px">Results are cached on this device and immediately update the school page, table and filters. They do not permanently rewrite the public master database.</div>`;
    host.appendChild(box);
    const runSetter=async()=>{status('Researching the latest official women’s volleyball roster and setter heights…');setResearchButtonsDisabled(true);try{const r=await researchSetter(d);saveResearch(d,'setter',r);rerenderForCurrentFilters();openSchool(d.key);status('Setter-height research completed and cached on this device.');}catch(e){status(`Setter research failed: ${e.message}`,true)}finally{setResearchButtonsDisabled(false)}};
    const runAid=async()=>{status('Researching official international undergraduate financial-aid policy…');setResearchButtonsDisabled(true);try{const r=await researchAid(d);saveResearch(d,'aid',r);rerenderForCurrentFilters();openSchool(d.key);status('International-aid research completed and cached on this device.');}catch(e){status(`Aid research failed: ${e.message}`,true)}finally{setResearchButtonsDisabled(false)}};
    document.getElementById('researchSetter').onclick=runSetter;
    document.getElementById('researchAid').onclick=runAid;
    document.getElementById('researchBoth').onclick=async()=>{status('Researching setter-height evidence and international financial aid…');setResearchButtonsDisabled(true);let errors=[];try{try{const r=await researchSetter(d);saveResearch(d,'setter',r)}catch(e){errors.push('setter: '+e.message)}try{const r=await researchAid(d);saveResearch(d,'aid',r)}catch(e){errors.push('aid: '+e.message)}rerenderForCurrentFilters();openSchool(d.key);status(errors.length?`Research finished with an issue (${errors.join('; ')})`:'Both research tasks completed and cached on this device.',!!errors.length)}finally{setResearchButtonsDisabled(false)}};
  }

  hydrateAll();
  openSchool=function(key){
    baseOpenSchool(key);
    const d=DATA.find(x=>x.key===key);
    if(d)appendResearchControls(d);
  };

  // Refresh rendered table/counts after applying any cached prior research.
  const aid=document.getElementById('aid');
  if(aid)aid.dispatchEvent(new Event('change',{bubbles:true}));
})();
