const TC_Engine = (() => {
  let state = null;
  let config = null;
  let rafId = null;
  let wpmInterval = null;
  let onUpdate = null;
  let onFinish = null;

  const defaultConfig = {
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

  function init(cfg, callbacks) {
    config = Object.assign({}, defaultConfig, cfg);
    onUpdate = callbacks.onUpdate || (() => {});
    onFinish = callbacks.onFinish || (() => {});
    reset();
  }

  function reset() {
    cancelAnimationFrame(rafId);
    clearInterval(wpmInterval);
    rafId = null;
    wpmInterval = null;

    const text = TC_TextGen.generate(config);
    const gm = config.gameMode;

    state = {
      status: 'idle',
      text,
      typed: new Array(text.length).fill(null),
      currentIndex: 0,
      startTime: null,
      endTime: null,
      keyErrors: {},
      correctedErrors: 0,
      wpmHistory: [],
      liveWpm: 0,
      liveAccuracy: 100,
      liveRawWpm: 0,
      // game mode state
      health: gm === 'survival' ? 5 : null,
      maxHealth: gm === 'survival' ? 5 : null,
      combo: 0,
      maxCombo: 0,
      finishReason: 'completed',
      progressiveStage: 1,
    };

    onUpdate({ type: 'reset', state, config });
  }

  function start() {
    if (state.status !== 'idle') return;
    state.status = 'typing';
    state.startTime = Date.now();

    wpmInterval = setInterval(() => {
      const elapsed = (Date.now() - state.startTime) / 1000;
      const correctChars = state.typed.filter(t => t && t.correct).length;
      state.wpmHistory.push(TC_Metrics.calcWPM(correctChars, elapsed));
    }, 1000);

    rafId = requestAnimationFrame(tick);
  }

  function tick() {
    if (state.status !== 'typing') return;

    const elapsed = (Date.now() - state.startTime) / 1000;
    const correctChars = state.typed.filter(t => t && t.correct).length;
    const totalTyped = state.typed.filter(t => t !== null).length;

    state.liveWpm = TC_Metrics.calcWPM(correctChars, elapsed);
    state.liveRawWpm = TC_Metrics.calcRawWPM(totalTyped, elapsed);
    state.liveAccuracy = TC_Metrics.calcAccuracy(state.typed);

    if (config.mode === 'time') {
      const remaining = config.duration - elapsed;
      onUpdate({ type: 'tick', elapsed, remaining: Math.max(0, remaining), state });
      if (remaining <= 0) {
        finish();
        return;
      }
    } else {
      onUpdate({ type: 'tick', elapsed, progress: state.currentIndex / state.text.length, state });
    }

    rafId = requestAnimationFrame(tick);
  }

  function handleChar(char) {
    if (state.status === 'finished') return;
    if (state.status === 'idle') start();
    if (state.currentIndex >= state.text.length) return;

    const expected = state.text[state.currentIndex];
    const isCorrect = char === expected;
    const gm = config.gameMode;

    state.typed[state.currentIndex] = {
      char,
      correct: isCorrect,
      timestamp: Date.now()
    };

    if (!isCorrect) {
      state.keyErrors[expected] = (state.keyErrors[expected] || 0) + 1;
    }

    state.currentIndex++;

    // --- Game mode rules ---

    // Perfect Run: end on first mistake
    if (!isCorrect && gm === 'perfect_run') {
      state.finishReason = 'failed';
      onUpdate({ type: 'char', index: state.currentIndex - 1, correct: isCorrect, state });
      finish();
      return;
    }

    // Survival: lose a life per mistake
    if (!isCorrect && gm === 'survival') {
      state.health = Math.max(0, state.health - 1);
      onUpdate({ type: 'health', health: state.health, maxHealth: state.maxHealth, state });
      if (state.health <= 0) {
        state.finishReason = 'health-zero';
        onUpdate({ type: 'char', index: state.currentIndex - 1, correct: isCorrect, state });
        finish();
        return;
      }
    }

    // Combo: track consecutive correct chars
    if (gm === 'combo') {
      if (isCorrect) {
        state.combo++;
        if (state.combo > state.maxCombo) state.maxCombo = state.combo;
      } else {
        state.combo = 0;
      }
      onUpdate({ type: 'combo', combo: state.combo, maxCombo: state.maxCombo, state });
    }

    // Progressive: track difficulty stage by position
    if (gm === 'progressive') {
      const stage = state.currentIndex < state.text.length / 3 ? 1
                  : state.currentIndex < (state.text.length * 2) / 3 ? 2 : 3;
      if (stage !== state.progressiveStage) {
        state.progressiveStage = stage;
        onUpdate({ type: 'progressive-stage', stage, state });
      }
    }

    onUpdate({ type: 'char', index: state.currentIndex - 1, correct: isCorrect, state });

    if (state.currentIndex >= state.text.length) {
      finish();
    }
  }

  function handleBackspace() {
    if (state.status === 'finished') return;
    if (config.strict) return;
    if (state.currentIndex === 0) return;

    state.currentIndex--;
    const prev = state.typed[state.currentIndex];
    if (prev && !prev.correct) {
      state.correctedErrors++;
    }
    state.typed[state.currentIndex] = null;

    onUpdate({ type: 'backspace', index: state.currentIndex, state });
  }

  function finish() {
    if (state.status === 'finished') return;
    cancelAnimationFrame(rafId);
    clearInterval(wpmInterval);
    state.status = 'finished';
    state.endTime = Date.now();

    if (config.mode === 'time') {
      state.typed = state.typed.slice(0, state.currentIndex);
    }

    const result = TC_Metrics.buildResult(state, config);
    onFinish(result);
  }

  function getState() { return state; }
  function getConfig() { return config; }
  function isActive() { return state && state.status === 'typing'; }
  function isIdle() { return state && state.status === 'idle'; }

  return { init, reset, handleChar, handleBackspace, getState, getConfig, isActive, isIdle, finish };
})();
