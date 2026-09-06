// Multi-select Athletic Fit + Admissions Reach controls.
// Empty selection means "All". Selecting All clears the specific options;
// selecting every specific option also collapses back to All.
(() => {
  const fitValues = ['Strong', 'Good', 'Reach'];
  const admissionsValues = ['Moderate', 'High', 'Extreme'];
  const selectedFits = new Set();
  const selectedAdmissions = new Set();
  const originalApplyFilters = applyFilters;

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

  bindGroup('fitMulti', selectedFits, fitValues);
  bindGroup('admissionsMulti', selectedAdmissions, admissionsValues);

  ['search', 'division', 'aid', 'setter', 'rank'].forEach(id => {
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
      document.getElementById('rank').value = 80;
      selectedFits.clear(); selectedAdmissions.clear();
      setButtonState('fitMulti', selectedFits, fitValues);
      setButtonState('admissionsMulti', selectedAdmissions, admissionsValues);
      applyMultiFilters();
    };
  }

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
