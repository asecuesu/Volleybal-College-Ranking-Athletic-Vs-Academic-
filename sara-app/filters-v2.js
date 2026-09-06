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
    if (summary) {
      summary.textContent = selected.size === 0 ? 'All' : [...selected].join(' + ');
    }
  }

  function normalizeSelection(selected, values) {
    if (selected.size === values.length || selected.size === 0) selected.clear();
  }

  function applyMultiFilters() {
    // Let the original app apply search, division, aid, setter and rank filters first.
    // The hidden legacy fit/admissions selects stay on All, so we layer multi-select here.
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
        if (value === 'All') {
          selected.clear();
        } else {
          if (selected.has(value)) selected.delete(value);
          else selected.add(value);
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

  // Re-apply the multi-select layer after any of the original single-value controls change.
  ['search', 'division', 'aid', 'setter', 'rank'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(id === 'search' ? 'input' : 'change', applyMultiFilters);
  });

  // Replace reset behavior so it also clears the multi-select state.
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
      selectedFits.clear();
      selectedAdmissions.clear();
      setButtonState('fitMulti', selectedFits, fitValues);
      setButtonState('admissionsMulti', selectedAdmissions, admissionsValues);
      applyMultiFilters();
    };
  }

  // Make the initial state explicit.
  applyMultiFilters();
})();
