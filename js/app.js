(() => {
  const cfg = {
    mode: 'time',
    duration: 60,
    wordCount: 50,
    difficulty: 'intermediate',
    textType: 'words',
    punctuation: false,
    strict: false
  };

  let currentScreen = 'home';
  let lastResult = null;
  let practiceConfig = null;

  // -- Init --
  function init() {
    bindNav();
    bindConfig();
    bindTestActions();
    bindResultsActions();
    bindPracticeActions();
    bindKeyboard();
    TC_UI.renderHomeStats();
    TC_UI.showScreen('home');
    setupEngine();
  }

  function setupEngine(overrides = {}) {
    const c = Object.assign({}, cfg, overrides);
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
      TC_UI.updateTimer(cfg.mode === 'time' ? cfg.duration : 0, cfg.mode);
      TC_UI.updateProgressBar(0);
      TC_UI.updateLiveMetrics({ liveWpm: 0, liveAccuracy: 100 });
      return;
    }

    if (type === 'char' || type === 'backspace') {
      TC_UI.refreshDisplay(state);
      TC_UI.updateLiveMetrics(state);
      if (cfg.mode === 'words') {
        TC_UI.updateProgressBar(state.currentIndex / state.text.length);
      }
    }

    if (type === 'tick') {
      TC_UI.updateLiveMetrics(state);
      if (cfg.mode === 'time') {
        TC_UI.updateTimer(remaining, 'time');
        TC_UI.updateProgressBar(1 - remaining / cfg.duration);
      } else {
        TC_UI.updateTimer(event.elapsed, 'words');
        TC_UI.updateProgressBar(progress);
      }
    }
  }

  function handleTestFinish(result) {
    lastResult = result;

    const storageData = TC_Storage.addTest(result);
    const xpGained = TC_Gamification.calcXP(result);
    TC_Storage.updateXP(xpGained);

    const freshData = TC_Storage.load();
    const newAchievements = TC_Gamification.checkAchievements(result, freshData);
    const analysis = TC_Analysis.analyzeTest(result);

    TC_UI.showScreen('results');
    TC_UI.renderResults(result, analysis, newAchievements, xpGained);
    TC_UI.renderHomeStats();
  }

  // -- Navigation --
  function bindNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.screen;
        navigateTo(target);
      });
    });
  }

  function navigateTo(screen) {
    // Stop any running test when leaving the test screen
    if (currentScreen === 'test' && screen !== 'test' && TC_Engine.isActive()) {
      restartEngine();
    }
    currentScreen = screen;
    TC_UI.showScreen(screen);
    if (screen === 'home') TC_UI.renderHomeStats();
    if (screen === 'progress') TC_UI.renderProgressScreen();
    if (screen === 'practice') TC_UI.renderPracticeScreen();
    if (screen === 'test') {
      document.getElementById('typing-area').focus();
    }
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
      if (!btn) return;
      document.querySelectorAll('#time-options .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      cfg.duration = parseInt(btn.dataset.value);
      restartEngine();
    });

    document.getElementById('words-options').addEventListener('click', e => {
      const btn = e.target.closest('.toggle-btn');
      if (!btn) return;
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
      restartEngine();
    });

    document.getElementById('punctuation-toggle').addEventListener('click', function() {
      cfg.punctuation = !cfg.punctuation;
      this.classList.toggle('active', cfg.punctuation);
      this.dataset.value = String(cfg.punctuation);
      restartEngine();
    });

    document.getElementById('strict-toggle').addEventListener('click', function() {
      cfg.strict = !cfg.strict;
      this.classList.toggle('active', cfg.strict);
      this.dataset.value = String(cfg.strict);
      restartEngine();
    });
  }

  function restartEngine() {
    setupEngine();
  }

  // -- Test actions --
  function bindTestActions() {
    document.getElementById('restart-btn').addEventListener('click', () => {
      restartEngine();
      navigateTo('test');
    });

    // Click on typing area to focus
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

    document.getElementById('practice-weak-btn').addEventListener('click', () => {
      navigateTo('practice');
    });

    document.getElementById('home-btn').addEventListener('click', () => {
      navigateTo('home');
    });
  }

  // -- Practice actions --
  function bindPracticeActions() {
    TC_UI.bindToggleGroup('practice-focus-toggle', val => {
      practiceConfig = val;
      const customArea = document.getElementById('custom-text-area');
      customArea.classList.toggle('hidden', val !== 'custom');
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
      const weakKeys = TC_Storage.getWeakKeys(5);
      text = TC_TextGen.generateFromWeakKeys(weakKeys);
    } else if (focus === 'numbers') {
      text = TC_DATA.numberText;
    } else if (focus === 'symbols') {
      text = TC_DATA.symbolText;
    } else {
      text = document.getElementById('custom-text-input').value.trim() ||
        TC_TextGen.generate(cfg);
    }

    setupEngineWithText(text);
    navigateTo('test');
  }

  function setupEngineWithText(text) {
    const c = Object.assign({}, cfg, { mode: 'words', wordCount: text.split(' ').length });
    TC_Engine.init(c, {
      onUpdate: handleEngineUpdate,
      onFinish: handleTestFinish
    });
    // Override text directly
    TC_Engine.getState().text = text;
    TC_Engine.getState().typed = new Array(text.length).fill(null);
    TC_Engine.getState().currentIndex = 0;
    TC_UI.renderTextDisplay(text);
    TC_UI.refreshDisplay(TC_Engine.getState());
  }

  // -- Global keyboard --
  function bindKeyboard() {
    document.addEventListener('keydown', e => {
      // Tab: restart from anywhere except forms
      if (e.key === 'Tab' && currentScreen === 'test') {
        e.preventDefault();
        restartEngine();
        return;
      }

      // Enter on home: go to test
      if (e.key === 'Enter' && currentScreen === 'home') {
        e.preventDefault();
        navigateTo('test');
        return;
      }

      // Enter/Tab on results: retry
      if ((e.key === 'Enter' || e.key === 'Tab') && currentScreen === 'results') {
        e.preventDefault();
        restartEngine();
        navigateTo('test');
        return;
      }

      // Escape: go home and cancel test
      if (e.key === 'Escape') {
        if (currentScreen === 'test') {
          restartEngine();
          navigateTo('home');
        }
        return;
      }

      // Typing input on test screen
      if (currentScreen !== 'test') return;

      if (e.ctrlKey || e.altKey || e.metaKey) return;

      e.preventDefault();

      if (e.key === 'Backspace') {
        TC_Engine.handleBackspace();
        return;
      }

      if (e.key === 'Enter') {
        TC_Engine.handleChar('\n');
        return;
      }

      if (e.key.length === 1) {
        TC_Engine.handleChar(e.key);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
