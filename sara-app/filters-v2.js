// Multi-select Athletic Fit + Admissions Reach controls, plus recruiting-context filters.
// International-aid filtering applies to D3 schools only; D1 schools remain visible
// because athletic scholarship evaluation is a separate recruiting question.
(() => {
  const fitValues = ['Strong', 'Good', 'Reach'];
  const admissionsValues = ['Moderate', 'High', 'Extreme'];
  const selectedFits = new Set();
  const selectedAdmissions = new Set();

  // ----- Add / relabel controls -----
  const aidSelect = document.getElementById('aid');
  if (aidSelect) {
    const aidField = aidSelect.closest('div');
    const label = aidField?.querySelector('label');
    if (label) label.textContent = 'International aid (D3 only)';
    if (aidField && !aidField.querySelector('.d3AidHint')) {
      const hint = document.createElement('div');
      hint.className = 'small d3AidHint';
      hint.style.marginTop = '4px';
      hint.textContent = 'Only filters D3. D1 schools always remain; athletic aid is evaluated separately.';
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
        <option value="unknown">Not researched</option>
      </select>
      <div class="small" style="margin-top:4px">Projects current setters forward to Sara’s fall 2028 entry year.</div>`;
    const setterField = setterSelect.closest('div');
    setterField?.insertAdjacentElement('afterend', wrap);
  }

  function setterUnresearched(d){
    return !d.setter_evidence || String(d.setter_evidence).toLowerCase() === 'not researched';
  }
  function needSignal(d){ return d.setter_need_2028 || 'Not researched'; }

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
      if(aid!=='All' && d.division==='D3'){
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
      aidMetric.textContent=filtered.filter(d=>d.division==='D3'&&d.aid_category!=='Not researched').length;
      const card=aidMetric.closest('.card');
      const smalls=card?.querySelectorAll('.small');
      if(smalls?.length){
        smalls[0].textContent='D3 international aid researched';
        if(smalls[1])smalls[1].textContent='Aid policy checked for D3 targets; D1 athletic aid is handled separately.';
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
      const sig=needSignal(d);
      const note=d.setter_need_2028_note || 'Not researched yet. Run “Research setter roster + 2028 opening” below to inspect the current official roster and setter class years.';
      grid.insertAdjacentHTML('beforeend', `<div class="detailBox"><h4>2028 setter roster opening</h4><b>${esc(sig)}</b><div class="small">${esc(note)}</div></div>`);
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
      <p>This is a <b>current-roster planning signal</b>, not a prediction that a coach will recruit a setter. The research identifies the setters on the latest official roster, records each listed class year, and projects normal year-by-year eligibility to Sara’s expected fall 2028 entry season.</p>
      <ul>
        <li><b>High:</b> at least one current setter is projected to finish before fall 2028 and no more than one currently listed setter projects to remain eligible in 2028.</li>
        <li><b>Medium:</b> meaningful turnover is projected before or during 2028, but at least one current setter may still remain.</li>
        <li><b>Low:</b> the currently listed setter group largely projects to remain through 2028, with no obvious pre-2028 opening from today’s roster.</li>
        <li><b>Unclear / Not researched:</b> class-year information is incomplete or the roster has not yet been researched.</li>
      </ul>
      <div class="notice"><b>Important:</b> this does not account for future recruits, transfers, redshirts, medical waivers, fifth-year eligibility, position changes or a coach deciding to carry more/fewer setters. It is best used as an outreach-priority signal, then confirmed directly with the coaching staff.</div>
      <h3 style="margin-top:18px">How the international-aid filter works</h3>
      <p>The international-aid selector now filters <b>D3 schools only</b>. D1 schools remain in the results regardless of that selector because athletic scholarship discussions are handled separately. D1 athletic aid is possible, but an offer or full scholarship should never be assumed until the coaching staff confirms it.</p>
    </div>`);
  }

  // ----- CSV now includes the 2028 opening signal -----
  function enhancedDownloadCSV(){
    const headers=['School','Division','Conference','Academic rank 2026','Athletic fit','Admissions reach','VB strength','2025 record','Setter range','Setter evidence','2028 setter opening','2028 opening note','Aid category','Aid note','Coach emails'];
    const lines=[headers.map(csvCell).join(',')];
    filtered.forEach(d=>lines.push([d.name,d.division,d.conference,d.academic_rank_2026,d.athletic_fit,d.admissions_reach,d.vb_strength,d.record_2025,d.setter_range,d.setter_evidence,needSignal(d),d.setter_need_2028_note||'',d.aid_category,d.aid_note,d.coach_contacts.map(c=>c.email).filter(Boolean).join('; ')].map(csvCell).join(',')));
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
      document.getElementById('rank').value = 80;
      selectedFits.clear(); selectedAdmissions.clear();
      setButtonState('fitMulti', selectedFits, fitValues);
      setButtonState('admissionsMulti', selectedAdmissions, admissionsValues);
      applyMultiFilters();
    };
  }
  const download=document.getElementById('download');
  if(download)download.onclick=enhancedDownloadCSV;

  applyMultiFilters();

  // Bootstrap the research layer after the main app is ready. The shared config
  // can stay blank until the Supabase function is deployed; research-v3 then
  // automatically falls back to browser-local storage.
  const configScript = document.createElement('script');
  configScript.src = 'sara-app/shared-config.js';
  configScript.onload = () => {
    const researchScript = document.createElement('script');
    researchScript.src = 'sara-app/research-v3.js';
    document.body.appendChild(researchScript);
  };
  document.body.appendChild(configScript);
})();
