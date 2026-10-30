// Volume controls, existing presets and mute state with explicit browser/audio adapters.
export function createVolumeController({document,$,engine,storage,defaults}) {
  const PRESETS = {
    balanced: { master: 75, noise: 70, drone: 60, notes: 55 },
    noise:    { master: 72, noise: 92, drone: 24, notes: 8 },
    minimal:  { master: 65, noise: 45, drone: 38, notes: 20 }
  };
  let muted=false,preMuteMaster=75;

  function updateRange(id, save = true) {
    const input = $('vol-' + id);
    const output = $('out-' + id);
    const value = Number(input.value);
    output.textContent = value + '%';
    input.style.setProperty('--progress', value + '%');
    engine.updateLevel(id,value);
    if (save) persistSettings();
    syncPresetState();
  }

  function loadSettings() {
    const saved=storage.read('focus-audio-settings-v2',null);
    Object.keys(defaults).forEach((id) => {
      const value = saved && Number.isFinite(saved[id]) ? Math.max(0, Math.min(100, saved[id])) : defaults[id];
      $('vol-' + id).value = value;
      updateRange(id, false);
    });
  }

  function persistSettings() {
    const settings = {};
    Object.keys(defaults).forEach((id) => { settings[id] = Number($('vol-' + id).value); });
    return storage.write('focus-audio-settings-v2',settings);
  }

  function syncPresetState() {
    document.querySelectorAll('[data-preset]').forEach((button) => {
      const preset = PRESETS[button.dataset.preset];
      const selected = preset && Object.keys(defaults).every((id) => Number($('vol-' + id).value) === preset[id]);
      button.setAttribute('aria-pressed', String(Boolean(selected)));
    });
  }

  function initVolumeControls() {
    document.querySelectorAll('.range').forEach((input) => {
      const id = input.id.replace('vol-', '');
      input.addEventListener('input', () => updateRange(id));
    });

    document.querySelectorAll('[data-preset]').forEach((button) => {
      button.addEventListener('click', () => {
        const values = PRESETS[button.dataset.preset];
        if (!values) return;
        Object.keys(values).forEach((id) => {
          $('vol-' + id).value = values[id];
          updateRange(id, false);
        });
        persistSettings();
        syncPresetState();
      });
    });
  }

  function toggleMute() {
    const masterInput = $('vol-master');
    if (!muted && Number(masterInput.value) > 0) {
      preMuteMaster = Number(masterInput.value);
      muted = true;
      masterInput.value = 0;
    } else {
      muted = false;
      masterInput.value = preMuteMaster || 75;
    }
    updateRange('master');
  }

  return {updateRange,loadSettings,persistSettings,initVolumeControls,toggleMute};
}
