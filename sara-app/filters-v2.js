// Multi-select Athletic Fit + Admissions Reach controls, plus recruiting-context filters.
// International-aid filtering applies to D3 schools only; D1 schools remain visible
// because athletic scholarship evaluation is a separate recruiting question.
(() => {
  const fitValues = ['Strong', 'Good', 'Reach', 'Unassessed'];
  const admissionsValues = ['Moderate', 'High', 'Extreme'];
  const selectedFits = new Set();
  const selectedAdmissions = new Set();
  const TARGET_SEASON = 2028;

  // ----- Add / relabel controls -----
  const aidSelect = document.getElementById('aid');
  if (aidSelect) {
    const aidField = aidSelect.closest('div');
    const label = aidField?.querySelector('label');
    if (label) label.textContent = 'International aid (when relevant)';
    if (aidField && !aidField.querySelector('.d3AidHint')) {
      const hint = document.createElement('div');
      hint.className = 'small d3AidHint';
      hint.style.marginTop = '4px';
      hint.textContent = 'Filters D3 and D1 programs such as the Ivy League where need-based aid, rather than athletic scholarships, is the relevant financing route. Scholarship-offering D1 programs remain visible.';
      aidField.appendChild(hint);
    }
  }

  const setterSelect = document.getElementById('setter');
  if (setterSelect && !document.getElementById('need2028')) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `<label>2028 setter opening</label>
      <select id="need2028">
        <option value="All">All</option>
        <option value="research">Opening researched</option>
        <option value="High">High opening signal</option>
        <option value="HighMedium">High + medium</option>
        <option value="Low">Low opening signal</option>
        <option value="unknown">Not researched / unclear</option>
      </select>
      <div class="small" style="margin-top:4px">Projects the latest official setter roster toward Sara’s fall 2028 entry year.</div>
      <div id="need2028Status" class="small" style="margin-top:5px;font-weight:600"></div>
      <button id="researchVisible2028" type="button" class="action" style="margin-top:7px" disabled>Research 2028 openings for visible schools</button>
      <div id="researchVisible2028Status" class="small" style="margin-top:5px"></div>`;
    const setterField = setterSelect.closest('div');
    setterField?.insertAdjacentElement('afterend', wrap);
  }

  function setterUnresearched(d){
    return !d.setter_evidence || String(d.setter_evidence).toLowerCase() === 'not researched';
  }
  function rosterClassIndex(v){
    const s=String(v||'').toLowerCase();
    if(/graduate|grad\.?|\bgr\.?\b|fifth|5th/.test(s))return 5;
    if(/senior|\bsr\.?\b/.test(s))return 4;
    if(/junior|\bjr\.?\b/.test(s))return 3;
    if(/sophomore|\bso\.?\b/.test(s))return 2;
    if(/freshman|first.year|\bfr\.?\b/.test(s))return 1;
    return null;
  }
  function needInfo(d){
    const detail=d.setter_need_2028_detail;
    const projected=detail?.projected||[];
    if(!projected.length){
      const sig=d.setter_need_2028||'Not researched';
      return {signal:sig,note:d.setter_need_2028_note||'Not researched yet. Run the setter-roster research to inspect current setter class years.'};
    }
    const rosterSeason=+(detail.rosterSeason||new Date().getFullYear());
    const known=projected.map(x=>{
      const idx=rosterClassIndex(x.classYear);
      if(!idx)return null;
      // D1 adopted a continuous five-year eligibility period in 2026. For a normal
      // class progression, FR/SO/JR/SR map roughly to 5/4/3/2 years in that window.
      // D3 remains on its existing model for this projection. Both are approximations.
      const lastSeason=d.division==='D1'
        ? rosterSeason + Math.max(0,5-idx)
        : rosterSeason + Math.max(0,4-idx);
      return {name:x.name||'Setter',classYear:x.classYear||'',lastSeason};
    }).filter(Boolean);
    if(!known.length || known.length<Math.ceil(projected.length/2))return {signal:'Unclear',note:'Current setter class-year information is too incomplete to make a useful fall 2028 roster projection.'};
    const departing=known.filter(x=>x.lastSeason<TARGET_SEASON);
    const finalInTarget=known.filter(x=>x.lastSeason===TARGET_SEASON);
    const remaining=known.filter(x=>x.lastSeason>=TARGET_SEASON);
    let signal='Low';
    if(departing.length>0 && remaining.length<=1)signal='High';
    else if(departing.length>0 || finalInTarget.length>0)signal='Medium';
    const namesDepart=departing.map(x=>`${x.name} (${x.classYear})`).join(', ');
    const namesRemain=remaining.map(x=>`${x.name} (${x.classYear})`).join(', ');
    let note;
    if(signal==='High')note=`High current-roster opening signal: ${departing.length} researched setter${departing.length===1?' is':'s are'} projected outside the normal eligibility/class window before fall 2028, with only ${remaining.length} of the currently listed setters projected to remain. ${namesDepart?`Potential turnover: ${namesDepart}.`:''}`;
    else if(signal==='Medium')note=`Medium current-roster opening signal: the present setter group shows turnover before or around fall 2028, but at least one current setter may still remain. ${namesRemain?`Potentially remaining: ${namesRemain}.`:''}`;
    else note=`Low current-roster opening signal: the researched current setters largely project to remain within their normal roster/eligibility window through fall 2028. ${namesRemain?`Potentially remaining: ${namesRemain}.`:''}`;
    if(d.division==='D1')note += ' D1 now uses a five-year age-based eligibility period, so roster class is only an approximation of actual remaining eligibility, especially for current athletes in transition.';
    else note += ' D3 class-year projection is also approximate and can be changed by transfers, roster decisions and any future eligibility-rule changes.';
    return {signal,note};
  }
  function needSignal(d){ return needInfo(d).signal; }
  function isNeedResearched(d){ return ['High','Medium','Low'].includes(needSignal(d)); }
  function update2028ResearchStatus(){
    const status=document.getElementById('need2028Status');
    if(!status)return;
    const n=DATA.filter(isNeedResearched).length;
    status.textContent=n
      ? `${n} of ${DATA.length} schools currently have a usable 2028-opening signal.`
      : `No schools have a usable 2028-opening signal yet on this device. Use the research button below or open a school and run its setter-roster research.`;
  }

  // This replaces the base filter logic for the enhanced controls. In particular,
  // D1 rows bypass the international-aid criterion.
  function projectApplyFilters(){
    const q=document.getElementById('search').value.trim().toLowerCase();
    const div=document.getElementById('division').value;
    const aid=document.getElementById('aid').value;
    const set=document.getElementById('setter').value;
    const need=document.getElementById('need2028')?.value || 'All';
    const max=+document.getElementById('rank').value;
    document.getElementById('rankOut').textContent=max;

    filtered=DATA.filter(d=>{
      if(q&&!(`${d.name} ${d.conference}`.toLowerCase().includes(q)))return false;
      if(div!=='All'&&d.division!==div)return false;
      if(d.academic_rank_2026>max)return false;

      // Financial-aid selector intentionally applies only to D3 schools.
      if(aid!=='All' && (d.division==='D3' || d.athletic_scholarships===false)){
        const g=aidGroup(d);
        if(aid==='researched'&&g==='unknown')return false;
        if(aid==='full'&&g!=='full')return false;
        if(aid==='limited'&&g!=='limited')return false;
        if(aid==='unknown'&&g!=='unknown')return false;
      }

      if(set!=='All'){
        const unresearched=setterUnresearched(d);
        if((set==='research'||set==='prior')&&unresearched)return false;
        if((set==='67'||set==='68')&&(d.setter_min_inches==null||d.setter_min_inches>+set))return false;
      }

      if(need!=='All'){
        const sig=needSignal(d);
        const researched=['High','Medium','Low'].includes(sig);
        if(need==='research'&&!researched)return false;
        if(need==='High'&&sig!=='High')return false;
        if(need==='HighMedium'&&!['High','Medium'].includes(sig))return false;
        if(need==='Low'&&sig!=='Low')return false;
        if(need==='unknown'&&researched)return false;
      }
      return true;
    });
    document.getElementById('count').textContent=`${filtered.length} of ${DATA.length} schools shown`;
    update2028ResearchStatus();
    renderAll();
  }

  const originalApplyFilters = projectApplyFilters;

  function setButtonState(groupId, selected, values) {
    const root = document.getElementById(groupId);
    if (!root) return;
    root.querySelectorAll('.multiChoice').forEach(btn => {
      const v = btn.dataset.value;
      const active = v === 'All' ? selected.size === 0 : selected.has(v);
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const summary = root.closest('.multiFilterField')?.querySelector('.multiSummary');
    if (summary) summary.textContent = selected.size === 0 ? 'All' : [...selected].join(' + ');
  }

  function normalizeSelection(selected, values) {
    if (selected.size === values.length || selected.size === 0) selected.clear();
  }

  function applyMultiFilters() {
    originalApplyFilters();
    if (selectedFits.size) filtered = filtered.filter(d => selectedFits.has(d.athletic_fit));
    if (selectedAdmissions.size) filtered = filtered.filter(d => selectedAdmissions.has(d.admissions_reach));
    document.getElementById('count').textContent = `${filtered.length} of ${DATA.length} schools shown`;
    renderAll();
  }

  function bindGroup(groupId, selected, values) {
    const root = document.getElementById(groupId);
    if (!root) return;
    root.querySelectorAll('.multiChoice').forEach(btn => {
      btn.addEventListener('click', () => {
        const value = btn.dataset.value;
        if (value === 'All') selected.clear();
        else {
          if (selected.has(value)) selected.delete(value); else selected.add(value);
          normalizeSelection(selected, values);
        }
        setButtonState(groupId, selected, values);
        applyMultiFilters();
      });
    });
    setButtonState(groupId, selected, values);
  }

  // ----- Enrich overview -----
  const baseRenderOverview = renderOverview;
  renderOverview = function(){
    baseRenderOverview();
    const aidMetric=document.getElementById('ovAid');
    if(aidMetric){
      aidMetric.textContent=filtered.filter(d=>(d.division==='D3'||d.athletic_scholarships===false)&&d.aid_category!=='Not researched').length;
      const card=aidMetric.closest('.card');
      const smalls=card?.querySelectorAll('.small');
      if(smalls?.length){
        smalls[0].textContent='Relevant international aid researched';
        if(smalls[1])smalls[1].textContent='Aid policy checked for D3 and Ivy/non-athletic-scholarship D1 targets; scholarship-offering D1 programs are handled separately.';
      }
    }
  };

  // ----- Add 2028 need signal into table's setter-evidence cell -----
  const baseRenderTable = renderTable;
  renderTable = function(){
    baseRenderTable();
    document.querySelectorAll('#tbody tr').forEach(row=>{
      const btn=row.querySelector('[data-school]');
      if(!btn || row.cells.length<9)return;
      const d=DATA.find(x=>x.key===btn.dataset.school);
      if(!d)return;
      const sig=needSignal(d);
      row.cells[8].insertAdjacentHTML('beforeend', `<br><span class="small"><b>2028 opening:</b> ${esc(sig)}</span>`);
    });
  };

  // ----- Add 2028 projection to school detail drawer -----
  const baseOpenSchool = openSchool;
  openSchool = function(key){
    baseOpenSchool(key);
    const d=DATA.find(x=>x.key===key);
    if(!d)return;
    const grid=document.querySelector('#dContent .detailGrid');
    if(grid){
      const info=needInfo(d);
      const note=info.note || 'Not researched yet. Run “Research setter roster + 2028 opening” below to inspect the current official roster and setter class years.';
      grid.insertAdjacentHTML('beforeend', `<div class="detailBox"><h4>2028 setter roster opening</h4><b>${esc(info.signal)}</b><div class="small">${esc(note)}</div></div>`);
    }
    // Aid is still useful background information for D1, but it is not part of the aid filter.
    if(d.division==='D1'){
      document.querySelectorAll('#dContent .detailBox').forEach(box=>{
        const h=box.querySelector('h4');
        if(h?.textContent==='International financial aid'){
          h.textContent='International financial aid (informational)';
          box.insertAdjacentHTML('beforeend','<div class="small" style="margin-top:6px">Not used by the aid filter for D1. Athletic scholarship availability and amount must be confirmed with the coaching staff and are not guaranteed.</div>');
        }
      });
    }
  };

  // ----- Methodology note for the new logic -----
  const sources=document.getElementById('sources');
  if(sources && !document.getElementById('recruiting2028Method')){
    sources.insertAdjacentHTML('beforebegin', `<div id="recruiting2028Method">
      <h3 style="margin-top:18px">2028 setter-opening signal</h3>
      <p>This is a <b>current-roster planning signal</b>, not a prediction that a coach will recruit a setter. The research identifies setters on the latest official roster, records each listed class year, and projects the current setter pipeline toward Sara’s expected fall 2028 entry season.</p>
      <ul>
        <li><b>High:</b> at least one currently listed setter projects to leave the normal roster/eligibility window before fall 2028 and no more than one current setter projects to remain.</li>
        <li><b>Medium:</b> meaningful turnover is projected before or around 2028, but at least one current setter may still remain.</li>
        <li><b>Low:</b> the currently listed setter group largely projects to remain through 2028, with no obvious opening from today’s roster.</li>
        <li><b>Unclear / Not researched:</b> class-year information is incomplete or the roster has not yet been researched.</li>
      </ul>
      <div class="notice"><b>Eligibility caveat:</b> Division I adopted a continuous five-year age-based eligibility period in 2026, so a roster label such as Jr. or Sr. does not perfectly identify remaining eligibility; the transition rules for current athletes can also change the result. The app therefore treats this as a probability signal, not a vacancy forecast. D3 projections use current class progression and are likewise approximate. Future recruits, transfers, roster decisions and rule changes can materially alter the 2028 setter room.</div>
      <h3 style="margin-top:18px">How the international-aid filter works</h3>
      <p>The international-aid selector filters <b>D3 schools and D1 programs where need-based aid is the relevant financing route</b>, notably the Ivy League. Ivy schools do not award athletic scholarships, but international applicants may qualify for institutional need-based aid under each university's policy. Other D1 schools remain in the results regardless of that selector because athletic scholarship discussions are handled separately.</p>
    </div>`);
  }

  // ----- CSV now includes the 2028 opening signal -----
  function enhancedDownloadCSV(){
    const headers=['School','Division','Conference','Academic rank 2026','Athletic fit','Admissions reach','VB strength','2025 record','Setter range','Setter evidence','2028 setter opening','2028 opening note','Aid category','Aid note','Coach emails'];
    const lines=[headers.map(csvCell).join(',')];
    filtered.forEach(d=>{const info=needInfo(d);lines.push([d.name,d.division,d.conference,d.academic_rank_2026,d.athletic_fit,d.admissions_reach,d.vb_strength,d.record_2025,d.setter_range,d.setter_evidence,info.signal,info.note,d.aid_category,d.aid_note,d.coach_contacts.map(c=>c.email).filter(Boolean).join('; ')].map(csvCell).join(','))});
    const blob=new Blob([lines.join('\n')],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='sara-volleyball-targets-filtered.csv';a.click();URL.revokeObjectURL(a.href);
  }

  bindGroup('fitMulti', selectedFits, fitValues);
  bindGroup('admissionsMulti', selectedAdmissions, admissionsValues);

  ['search', 'division', 'aid', 'setter', 'need2028', 'rank'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(id === 'search' ? 'input' : 'change', applyMultiFilters);
  });

  const reset = document.getElementById('reset');
  if (reset) {
    reset.onclick = () => {
      document.getElementById('search').value = '';
      document.getElementById('division').value = 'All';
      document.getElementById('fit').value = 'All';
      document.getElementById('admissions').value = 'All';
      document.getElementById('aid').value = 'All';
      document.getElementById('setter').value = 'All';
      if(document.getElementById('need2028'))document.getElementById('need2028').value='All';
      document.getElementById('rank').value = 100;
      selectedFits.clear(); selectedAdmissions.clear();
      setButtonState('fitMulti', selectedFits, fitValues);
      setButtonState('admissionsMulti', selectedAdmissions, admissionsValues);
      applyMultiFilters();
    };
  }
  const download=document.getElementById('download');
  if(download)download.onclick=enhancedDownloadCSV;

  const researchVisibleBtn=document.getElementById('researchVisible2028');
  const researchVisibleStatus=document.getElementById('researchVisible2028Status');
  function syncResearchButton(){
    if(!researchVisibleBtn)return;
    researchVisibleBtn.disabled=typeof window.SARA_research2028Batch!=='function';
  }
  if(researchVisibleBtn){
    researchVisibleBtn.onclick=async()=>{
      if(typeof window.SARA_research2028Batch!=='function')return;
      const previous=document.getElementById('need2028')?.value||'All';
      if(document.getElementById('need2028'))document.getElementById('need2028').value='All';
      applyMultiFilters();
      const keys=filtered.filter(d=>!isNeedResearched(d)).map(d=>d.key);
      if(document.getElementById('need2028'))document.getElementById('need2028').value=previous;
      applyMultiFilters();
      if(!keys.length){
        if(researchVisibleStatus)researchVisibleStatus.textContent='All currently visible schools already have a usable 2028-opening signal.';
        return;
      }
      if(keys.length>20 && !window.confirm(`This will research up to ${keys.length} schools and may use AI/search credits for uncached schools. Continue?`))return;
      researchVisibleBtn.disabled=true;
      if(researchVisibleStatus)researchVisibleStatus.textContent=`Starting 0 of ${keys.length}…`;
      try{
        const result=await window.SARA_research2028Batch(keys,(done,total,key,state)=>{
          if(researchVisibleStatus)researchVisibleStatus.textContent=`Researching ${done} of ${total}… ${state||key}`;
        });
        if(researchVisibleStatus)researchVisibleStatus.textContent=`Finished: ${result.completed} researched, ${result.failed} failed. Re-apply the 2028-opening filter to see High / Medium / Low results.`;
        applyMultiFilters();
      }catch(e){
        if(researchVisibleStatus)researchVisibleStatus.textContent='Batch research stopped: '+e.message;
      }finally{
        syncResearchButton();
      }
    };
  }
  window.addEventListener('sara-research-ready',syncResearchButton);
  syncResearchButton();
  update2028ResearchStatus();

  applyMultiFilters();

  // Bootstrap the research layer after the main app is ready. The shared config
  // can stay blank until the Supabase function is deployed; research-v3 then
  // automatically falls back to browser-local storage.
  const configScript = document.createElement('script');
  configScript.src = 'sara-app/shared-config.js';
  configScript.onload = () => {
    const researchScript = document.createElement('script');
    researchScript.src = 'sara-app/research-v3.js';
    researchScript.onload = () => {
      const extraScript = document.createElement('script');
      extraScript.src = 'sara-app/research-extra.js';
      document.body.appendChild(extraScript);
    };
    document.body.appendChild(researchScript);
  };
  document.body.appendChild(configScript);
})();
