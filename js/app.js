(() => {
  const cfg = {
    mode: 'time',
    duration: 60,
    wordCount: 50,
    difficulty: 'intermediate',
    textType: 'words',
    punctuation: false,
    strict: false,
    gameMode: 'classic',
    specialText: null,
  };

  let currentScreen = 'home';
  let lastResult = null;
  let practiceConfig = null;
  let modalOpen = false;

  // -- Init --
  function init() {
    bindNav();
    bindConfig();
    bindModeSelector();
    bindTestActions();
    bindResultsActions();
    bindPracticeActions();
    bindKeyboard();
    TC_UI.renderHomeStats();
    TC_UI.renderModeGrid(cfg.gameMode);
    TC_UI.showScreen('home');
    setupEngine();
  }

  function setupEngine(overrides = {}) {
    const mode = TC_DATA.modes.find(m => m.id === cfg.gameMode) || TC_DATA.modes[0];
    const c = Object.assign({}, cfg, mode.configOverrides, overrides, {
      gameMode: cfg.gameMode,
      specialText: mode.specialText || null,
    });
    TC_Engine.init(c, {
      onUpdate: handleEngineUpdate,
      onFinish: handleTestFinish
    });
    TC_UI.renderTextDisplay(TC_Engine.getState().text);
    TC_UI.refreshDisplay(TC_Engine.getState());
  }

  // -- Engine callbacks --
  function handleEngineUpdate(event) {
    const { type, state, remaining, progress } = event;

    if (type === 'reset') {
      TC_UI.renderTextDisplay(state.text);
      TC_UI.refreshDisplay(state);
      const activeCfg = TC_Engine.getConfig();
      TC_UI.updateTimer(activeCfg.mode === 'time' ? activeCfg.duration : 0, activeCfg.mode);
      TC_UI.updateProgressBar(0);
      TC_UI.updateLiveMetrics({ liveWpm: 0, liveAccuracy: 100 });
      TC_UI.showModeOverlays(cfg.gameMode);
      if (state.health !== null) TC_UI.updateHealthDisplay(state.health, state.maxHealth);
      TC_UI.updateComboDisplay(0, 0);
      return;
    }

    if (type === 'char' || type === 'backspace') {
      TC_UI.refreshDisplay(state);
      TC_UI.updateLiveMetrics(state);
      const activeCfg = TC_Engine.getConfig();
      if (activeCfg.mode === 'words') {
        TC_UI.updateProgressBar(state.currentIndex / state.text.length);
      }
    }

    if (type === 'tick') {
      TC_UI.updateLiveMetrics(state);
      const activeCfg = TC_Engine.getConfig();
      if (activeCfg.mode === 'time') {
        TC_UI.updateTimer(remaining, 'time');
        TC_UI.updateProgressBar(1 - remaining / activeCfg.duration);
      } else {
        TC_UI.updateTimer(event.elapsed, 'words');
        TC_UI.updateProgressBar(progress);
      }
    }

    if (type === 'health') {
      TC_UI.updateHealthDisplay(event.health, event.maxHealth);
    }

    if (type === 'combo') {
      TC_UI.updateComboDisplay(event.combo, event.maxCombo);
    }

    if (type === 'progressive-stage') {
      TC_UI.updateStageBanner(event.stage);
    }
  }

  function handleTestFinish(result) {
    lastResult = result;

    TC_Storage.addTest(result);
    TC_Storage.updateModeBest(result.gameMode, result);
    const xpGained = TC_Gamification.calcXP(result);
    TC_Storage.updateXP(xpGained);

    const freshData = TC_Storage.load();
    const newAchievements = TC_Gamification.checkAchievements(result, freshData);
    const analysis = TC_Analysis.analyzeTest(result);

    navigateTo('results');
    TC_UI.renderResults(result, analysis, newAchievements, xpGained);
    TC_UI.renderHomeStats();
  }

  // -- Navigation --
  function bindNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.screen));
    });
    const logo = document.querySelector('.logo');
    if (logo) logo.addEventListener('click', () => navigateTo('home'));
  }

  function navigateTo(screen) {
    if (modalOpen && screen !== 'home') closeModeModal();
    if (currentScreen === 'test' && screen !== 'test' && TC_Engine.isActive()) {
      restartEngine();
    }
    currentScreen = screen;
    TC_UI.showScreen(screen);
    if (screen === 'home') {
      TC_UI.renderHomeStats();
      TC_UI.renderModeGrid(cfg.gameMode);
    }
    if (screen === 'test') updateTypingHint();
    if (screen === 'progress') TC_UI.renderProgressScreen();
    if (screen === 'practice') TC_UI.renderPracticeScreen();
    if (screen === 'test') document.getElementById('typing-area').focus();
  }

  // -- Modal --
  function openModeModal(modeId) {
    const mode = TC_DATA.modes.find(m => m.id === modeId);
    if (!mode) return;
    document.getElementById('modal-mode-icon').textContent = mode.icon;
    document.getElementById('modal-mode-name').textContent = mode.label;
    document.getElementById('modal-mode-desc').textContent = mode.desc;
    const textTypeGroup = document.querySelector('#text-type-toggle').closest('.config-group');
    textTypeGroup.classList.toggle('hidden', modeId === 'code');
    document.getElementById('mode-modal-overlay').classList.remove('hidden');
    document.getElementById('modal-start-btn').focus();
    modalOpen = true;
  }

  function closeModeModal() {
    document.getElementById('mode-modal-overlay').classList.add('hidden');
    modalOpen = false;
  }

  // -- Mode selector --
  function bindModeSelector() {
    const grid = document.getElementById('mode-grid');
    if (!grid) return;
    grid.addEventListener('click', e => {
      const card = e.target.closest('.mode-card');
      if (!card) return;
      const modeId = card.dataset.modeId;
      if (modeId !== cfg.gameMode) {
        cfg.gameMode = modeId;
        applyModeConstraints(modeId);
        TC_UI.renderModeGrid(modeId);
        updateModeDescription(modeId);
        restartEngine();
      }
      openModeModal(modeId);
    });

    document.getElementById('modal-close-btn').addEventListener('click', closeModeModal);

    document.getElementById('mode-modal-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('mode-modal-overlay')) closeModeModal();
    });

    document.getElementById('modal-start-btn').addEventListener('click', () => {
      closeModeModal();
      restartEngine();
      navigateTo('test');
    });
  }

  function applyModeConstraints(modeId) {
    const mode = TC_DATA.modes.find(m => m.id === modeId);
    if (!mode) return;

    // Apply configOverrides to cfg
    Object.assign(cfg, mode.configOverrides);

    // Update UI toggles to reflect overrides
    if (mode.configOverrides.mode) {
      document.querySelectorAll('#mode-toggle .toggle-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.value === mode.configOverrides.mode);
      });
      const isTime = mode.configOverrides.mode === 'time';
      document.getElementById('time-options').classList.toggle('hidden', !isTime);
      document.getElementById('words-options').classList.toggle('hidden', isTime);
    }
    if (mode.configOverrides.duration) {
      document.querySelectorAll('#time-options .toggle-btn').forEach(b => {
        b.classList.remove('active');
      });
      // Add a temporary display if duration isn't one of the presets
      const preset = document.querySelector(`#time-options .toggle-btn[data-value="${mode.configOverrides.duration}"]`);
      if (preset) preset.classList.add('active');
    }
    if (mode.configOverrides.textType) {
      document.querySelectorAll('#text-type-toggle .toggle-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.value === mode.configOverrides.textType);
        b.disabled = mode.lockedOptions.includes('textType') && b.dataset.value !== mode.configOverrides.textType;
      });
    }

    // Grey out locked options
    const allGroups = {
      mode:        '#mode-toggle .toggle-btn',
      duration:    '#time-options .toggle-btn, #words-options .toggle-btn',
      difficulty:  '#difficulty-toggle .toggle-btn',
      textType:    '#text-type-toggle .toggle-btn',
      punctuation: '#punctuation-toggle',
    };
    for (const [key, selector] of Object.entries(allGroups)) {
      document.querySelectorAll(selector).forEach(el => {
        el.disabled = mode.lockedOptions.includes(key);
        el.classList.toggle('locked', mode.lockedOptions.includes(key));
      });
    }

    // Update mode badge in test screen
    TC_UI.setModeBadge(mode);
  }

  function updateModeDescription(modeId) {
    const mode = TC_DATA.modes.find(m => m.id === modeId);
    const el = document.getElementById('mode-description');
    if (el && mode) el.textContent = mode.desc;
  }

  // -- Config bindings --
  function bindConfig() {
    TC_UI.bindToggleGroup('mode-toggle', val => {
      cfg.mode = val;
      document.getElementById('time-options').classList.toggle('hidden', val === 'words');
      document.getElementById('words-options').classList.toggle('hidden', val === 'time');
      restartEngine();
    });

    document.getElementById('time-options').addEventListener('click', e => {
      const btn = e.target.closest('.toggle-btn');
      if (!btn || btn.disabled) return;
      document.querySelectorAll('#time-options .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      cfg.duration = parseInt(btn.dataset.value);
      restartEngine();
    });

    document.getElementById('words-options').addEventListener('click', e => {
      const btn = e.target.closest('.toggle-btn');
      if (!btn || btn.disabled) return;
      document.querySelectorAll('#words-options .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      cfg.wordCount = parseInt(btn.dataset.value);
      restartEngine();
    });

    TC_UI.bindToggleGroup('difficulty-toggle', val => {
      cfg.difficulty = val;
      restartEngine();
    });

    TC_UI.bindToggleGroup('text-type-toggle', val => {
      cfg.textType = val;
      updateTypingHint();
      restartEngine();
    });

    document.getElementById('punctuation-toggle').addEventListener('click', function() {
      if (this.disabled) return;
      cfg.punctuation = !cfg.punctuation;
      this.classList.toggle('active', cfg.punctuation);
      restartEngine();
    });

    document.getElementById('strict-toggle').addEventListener('click', function() {
      if (this.disabled) return;
      cfg.strict = !cfg.strict;
      this.classList.toggle('active', cfg.strict);
      restartEngine();
    });
  }

  function restartEngine() {
    setupEngine();
  }

  function updateTypingHint() {
    const hint = document.querySelector('.typing-hint');
    if (!hint) return;
    hint.innerHTML = cfg.textType === 'code'
      ? 'Start typing · <kbd>Esc</kbd> exit'
      : 'Start typing · <kbd>Tab</kbd> restart · <kbd>Esc</kbd> exit';
  }

  // -- Test actions --
  function bindTestActions() {
    document.getElementById('restart-btn').addEventListener('click', () => {
      restartEngine();
      navigateTo('test');
    });
    document.getElementById('typing-area').addEventListener('click', () => {
      document.getElementById('typing-area').focus();
    });
  }

  // -- Results actions --
  function bindResultsActions() {
    document.getElementById('retry-btn').addEventListener('click', () => {
      restartEngine();
      navigateTo('test');
    });
    document.getElementById('practice-weak-btn').addEventListener('click', () => navigateTo('practice'));
    document.getElementById('home-btn').addEventListener('click', () => navigateTo('home'));
  }

  // -- Practice actions --
  function bindPracticeActions() {
    TC_UI.bindToggleGroup('practice-focus-toggle', val => {
      practiceConfig = val;
      document.getElementById('custom-text-area').classList.toggle('hidden', val !== 'custom');
    });
    document.getElementById('start-practice-btn').addEventListener('click', startPractice);
    document.getElementById('start-custom-btn').addEventListener('click', () => {
      const text = document.getElementById('custom-text-input').value.trim();
      if (!text) return;
      setupEngineWithText(text);
      navigateTo('test');
    });
  }

  function startPractice() {
    const focus = practiceConfig || 'weak-keys';
    let text;
    if (focus === 'weak-keys') {
      text = TC_TextGen.generateFromWeakKeys(TC_Storage.getWeakKeys(5));
    } else if (focus === 'numbers') {
      text = TC_DATA.numberText;
    } else if (focus === 'symbols') {
      text = TC_DATA.symbolText;
    } else {
      text = document.getElementById('custom-text-input').value.trim() || TC_TextGen.generate(cfg);
    }
    setupEngineWithText(text);
    navigateTo('test');
  }

  function setupEngineWithText(text) {
    const c = Object.assign({}, cfg, { mode: 'words', wordCount: text.split(' ').length, specialText: null });
    TC_Engine.init(c, { onUpdate: handleEngineUpdate, onFinish: handleTestFinish });
    TC_Engine.getState().text = text;
    TC_Engine.getState().typed = new Array(text.length).fill(null);
    TC_Engine.getState().currentIndex = 0;
    TC_UI.renderTextDisplay(text);
    TC_UI.refreshDisplay(TC_Engine.getState());
  }

  // -- Global keyboard --
  function bindKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (modalOpen) { e.preventDefault(); closeModeModal(); return; }
        if (currentScreen === 'test') { restartEngine(); navigateTo('home'); }
        return;
      }
      if (e.key === 'Enter' && modalOpen) {
        e.preventDefault();
        closeModeModal();
        navigateTo('test');
        return;
      }
      if (e.key === 'Tab' && currentScreen === 'test') {
        e.preventDefault();
        if (cfg.textType === 'code') { TC_Engine.handleChar('\t'); return; }
        restartEngine();
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && currentScreen === 'results') {
        e.preventDefault();
        restartEngine();
        navigateTo('test');
        return;
      }

      if (currentScreen !== 'test') return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      e.preventDefault();

      if (e.key === 'Backspace') { TC_Engine.handleBackspace(); return; }
      if (e.key === 'Enter') { TC_Engine.handleChar('\n'); return; }
      if (e.key.length === 1) TC_Engine.handleChar(e.key);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
