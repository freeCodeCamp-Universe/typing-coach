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
  let pauseOpen = false;
  let prevModeOverrides = {};
  let modeModalTrigger = null;
  let modeModalTriggerModeId = null;
  let resetModalTrigger = null;

  const SCREEN_STORAGE_KEY = 'tc_current_screen';
  const RESTORABLE_SCREENS = ['home', 'progress', 'practice'];

  function getRestorableScreen() {
    // 'test'/'results' hold in-progress engine state that isn't persisted,
    // so a reload can't meaningfully resume them — fall back to home.
    const saved = sessionStorage.getItem(SCREEN_STORAGE_KEY);
    return RESTORABLE_SCREENS.includes(saved) ? saved : 'home';
  }

  // -- Focus trapping (shared by all modals) --
  function getFocusableElements(container) {
    return Array.from(container.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]'
    )).filter(el => !el.disabled && el.tabIndex !== -1 && el.offsetParent !== null);
  }

  function trapFocusKey(e, container) {
    if (e.key !== 'Tab') return;
    const focusable = getFocusableElements(container);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first || !container.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last || !container.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  }

  // -- Init --
  function init() {
    bindNav();
    bindConfig();
    bindModeSelector();
    bindTestActions();
    bindResultsActions();
    bindPracticeActions();
    bindProgressActions();
    bindKeyboard();
    bindPauseActions();
    bindAutoPause();
    TC_UI.renderHomeStats();
    TC_UI.renderModeGrid(cfg.gameMode);
    setupEngine();
    navigateTo(getRestorableScreen());
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
      TC_A11y.resetState(state, activeCfg);
      pauseOpen = false;
      TC_UI.hidePauseOverlay();
      TC_UI.setPauseButtonState('idle');
      return;
    }

    if (type === 'paused') {
      TC_UI.showPauseOverlay();
      TC_UI.setPauseButtonState('paused');
      TC_A11y.onPause();
      return;
    }

    if (type === 'resumed') {
      TC_UI.hidePauseOverlay();
      TC_UI.setPauseButtonState(state.status);
      TC_A11y.onResume();
      return;
    }

    if (type === 'text-extended') {
      const container = document.getElementById('typing-area');
      const savedScrollTop = container ? container.scrollTop : 0;
      TC_UI.renderTextDisplay(state.text);
      if (container) container.scrollTop = savedScrollTop;
      TC_UI.refreshDisplay(state);
      TC_A11y.onTextExtended();
    }

    if (type === 'char' || type === 'backspace') {
      TC_UI.refreshDisplay(state);
      TC_UI.updateLiveMetrics(state);
      const activeCfg = TC_Engine.getConfig();
      if (activeCfg.mode === 'words') {
        TC_UI.updateProgressBar(state.currentIndex / state.text.length);
      }
      TC_UI.setPauseButtonState('typing');
      if (type === 'char') TC_A11y.onChar(state);
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
      TC_A11y.onTick(event, activeCfg);
    }

    if (type === 'health') {
      TC_UI.updateHealthDisplay(event.health, event.maxHealth);
      TC_A11y.onHealth(event.health, event.maxHealth);
    }

    if (type === 'combo') {
      TC_UI.updateComboDisplay(event.combo, event.maxCombo);
      TC_A11y.onCombo(event.combo, event.maxCombo);
    }

    if (type === 'progressive-stage') {
      TC_UI.updateStageBanner(event.stage);
      TC_A11y.onStage(event.stage);
    }
  }

  function handleTestFinish(result) {
    lastResult = result;

    TC_UI.setPauseButtonState('idle');
    TC_A11y.onFinish(result);
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
    if (currentScreen === 'test' && screen !== 'test' && (TC_Engine.isActive() || TC_Engine.isPaused())) {
      restartEngine();
    }
    currentScreen = screen;
    sessionStorage.setItem(SCREEN_STORAGE_KEY, screen);
    TC_UI.showScreen(screen);
    if (screen === 'home') {
      TC_UI.renderHomeStats();
      TC_UI.renderModeGrid(cfg.gameMode);
    }
    if (screen === 'test') updateTypingHint();
    if (screen === 'progress') TC_UI.renderProgressScreen();
    if (screen === 'practice') TC_UI.renderPracticeScreen();
    if (screen === 'test') {
      document.getElementById('typing-input').focus();
      TC_A11y.announceReady(TC_Engine.getState(), TC_Engine.getConfig());
    }
  }

  // -- Modal --
  function openModeModal(modeId, triggerEl) {
    const mode = TC_DATA.modes.find(m => m.id === modeId);
    if (!mode) return;
    modeModalTrigger = triggerEl || document.activeElement;
    modeModalTriggerModeId = modeId;
    document.getElementById('modal-mode-icon').innerHTML = mode.icon;
    document.getElementById('modal-mode-name').textContent = mode.label;
    document.getElementById('modal-mode-desc').textContent = mode.desc;
    const textTypeGroup = document.querySelector('#text-type-toggle').closest('.config-group');
    textTypeGroup.classList.toggle('hidden', modeId === 'code');
    document.getElementById('mode-modal-overlay').classList.remove('hidden');
    const configPanel = document.querySelector('#mode-modal .config-panel');
    const firstOption = getFocusableElements(configPanel)[0];
    (firstOption || document.getElementById('modal-start-btn')).focus();
    modalOpen = true;
  }

  function closeModeModal() {
    document.getElementById('mode-modal-overlay').classList.add('hidden');
    modalOpen = false;
    focusModeModalTrigger();
    modeModalTrigger = null;
    modeModalTriggerModeId = null;
  }

  function focusModeModalTrigger() {
    if (modeModalTrigger && document.body.contains(modeModalTrigger)) {
      modeModalTrigger.focus();
      return;
    }
    // Selecting a new mode re-renders #mode-grid, detaching the original card
    // element — fall back to the freshly rendered card for the same mode.
    if (modeModalTriggerModeId) {
      const liveCard = document.querySelector(`.mode-card[data-mode-id="${modeModalTriggerModeId}"]`);
      if (liveCard) liveCard.focus();
    }
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
      openModeModal(modeId, card);
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

    // Reset properties forced by the previous mode that the new mode doesn't override
    const cfgDefaults = { mode: 'time', duration: 60, strict: false, textType: 'words' };
    for (const key of Object.keys(prevModeOverrides)) {
      if (!(key in mode.configOverrides) && key in cfgDefaults) {
        cfg[key] = cfgDefaults[key];
      }
    }
    prevModeOverrides = mode.configOverrides;

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
    } else {
      // Sync text-type toggle to cfg.textType (handles reset after leaving code mode)
      document.querySelectorAll('#text-type-toggle .toggle-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.value === cfg.textType);
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
    hint.innerHTML = 'Start typing · <kbd>F2</kbd> restart · <kbd>Esc</kbd> pause';
  }

  // -- Test actions --
  function bindTestActions() {
    document.getElementById('restart-btn').addEventListener('click', () => {
      restartEngine();
      navigateTo('test');
    });
    document.getElementById('typing-area').addEventListener('click', () => {
      document.getElementById('typing-input').focus();
    });
    document.getElementById('pause-btn').addEventListener('click', () => {
      if (TC_Engine.isActive() || TC_Engine.isIdle()) pauseTest();
      else if (TC_Engine.isPaused()) resumeTest();
    });
  }

  // -- Pause --
  function pauseTest() {
    if (!TC_Engine.isActive() && !TC_Engine.isIdle()) return;
    pauseOpen = true;
    TC_Engine.pause();
  }

  function resumeTest() {
    if (!TC_Engine.isPaused()) return;
    TC_Engine.resume();
    pauseOpen = false;
    document.getElementById('typing-input').focus();
  }

  function bindPauseActions() {
    document.getElementById('pause-resume-btn').addEventListener('click', resumeTest);
    document.getElementById('pause-restart-btn').addEventListener('click', () => {
      restartEngine();
      navigateTo('test');
    });
    document.getElementById('pause-exit-btn').addEventListener('click', () => {
      restartEngine();
      navigateTo('home');
    });
  }

  function bindAutoPause() {
    window.addEventListener('blur', () => {
      if (currentScreen === 'test' && TC_Engine.isActive()) pauseTest();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && currentScreen === 'test' && TC_Engine.isActive()) pauseTest();
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

  // -- Progress actions --
  function closeResetModal() {
    const overlay = document.getElementById('reset-confirm-overlay');
    overlay.classList.add('hidden');
    if (resetModalTrigger && document.body.contains(resetModalTrigger)) {
      resetModalTrigger.focus();
    }
    resetModalTrigger = null;
  }

  function bindProgressActions() {
    const overlay = document.getElementById('reset-confirm-overlay');

    document.getElementById('reset-progress-btn').addEventListener('click', e => {
      resetModalTrigger = e.currentTarget;
      overlay.classList.remove('hidden');
      document.getElementById('reset-cancel-btn').focus();
    });

    document.getElementById('reset-cancel-btn').addEventListener('click', closeResetModal);

    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeResetModal();
    });

    document.getElementById('reset-confirm-btn').addEventListener('click', () => {
      TC_Storage.clearAll();
      closeResetModal();
      navigateTo('home');
    });
  }

  // -- Practice actions --
  function bindPracticeActions() {
    TC_UI.bindToggleGroup('practice-focus-toggle', val => {
      practiceConfig = val;
      document.getElementById('custom-text-area').classList.toggle('hidden', val !== 'custom');
      document.getElementById('weak-keys-display').classList.toggle('hidden', val !== 'weak-keys');
      hideCustomTextError();
    });
    document.getElementById('start-practice-btn').addEventListener('click', startPractice);
    document.getElementById('custom-text-input').addEventListener('input', hideCustomTextError);
  }

  function hideCustomTextError() {
    document.getElementById('custom-text-error').classList.add('hidden');
  }

  function showCustomTextError() {
    const message = 'Enter some text before starting practice.';
    document.getElementById('custom-text-error').classList.remove('hidden');
    TC_A11y.announce(message, true);
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
      text = document.getElementById('custom-text-input').value.trim();
      if (!text) {
        showCustomTextError();
        return;
      }
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
      const resetOverlay = document.getElementById('reset-confirm-overlay');
      const resetOpen = !resetOverlay.classList.contains('hidden');

      if (e.key === 'Tab' && resetOpen) { trapFocusKey(e, resetOverlay); return; }
      if (e.key === 'Tab' && modalOpen) {
        trapFocusKey(e, document.getElementById('mode-modal-overlay'));
        return;
      }
      if (e.key === 'Tab' && pauseOpen) {
        trapFocusKey(e, document.getElementById('pause-overlay'));
        return;
      }

      if (e.key === 'Escape') {
        if (resetOpen) { closeResetModal(); return; }
        if (modalOpen) { e.preventDefault(); closeModeModal(); return; }
        if (pauseOpen) { e.preventDefault(); resumeTest(); return; }
        if (currentScreen === 'test') { e.preventDefault(); pauseTest(); return; }
        return;
      }
      if (e.key === 'Enter' && modalOpen) {
        e.preventDefault();
        closeModeModal();
        navigateTo('test');
        return;
      }
      if (e.key === 'Tab' && currentScreen === 'test' && cfg.textType === 'code') {
        e.preventDefault();
        TC_Engine.handleChar('\t');
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        if (currentScreen === 'test') {
          restartEngine();
          TC_A11y.announceReady(TC_Engine.getState(), TC_Engine.getConfig());
          return;
        }
        if (currentScreen === 'results') { restartEngine(); navigateTo('test'); return; }
        return;
      }
      if (e.key === 'Enter' && currentScreen === 'results') {
        e.preventDefault();
        restartEngine();
        navigateTo('test');
        return;
      }

      if (currentScreen !== 'test') return;
      if (pauseOpen) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      e.preventDefault();

      if (e.key === 'Backspace') { TC_Engine.handleBackspace(); return; }
      if (e.key === 'Enter') { TC_Engine.handleChar('\n'); return; }
      if (e.key.length === 1) TC_Engine.handleChar(e.key);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
