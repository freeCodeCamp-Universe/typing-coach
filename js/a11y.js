const TC_A11y = (() => {
  const BATCH_SIZE = 8;
  const STREAK_BREAK_THRESHOLD = 5;
  const TIME_MILESTONES = [30, 15, 10, 5, 3, 2, 1];
  const STAGE_LABELS = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' };

  let nextBatchIndex = 0;
  let prevHealth = null;
  let prevCombo = 0;
  let lastTimeInfo = '';
  let announcedMilestones = new Set();

  function computeWords(text) {
    const words = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(text))) {
      words.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
    return words;
  }

  function announce(message, assertive) {
    const el = document.getElementById(assertive ? 'sr-live-assertive' : 'sr-live-polite');
    if (!el) return;
    el.textContent = '';
    requestAnimationFrame(() => { el.textContent = message; });
  }

  // Called on every engine 'reset' event, regardless of which screen is active.
  function resetState(state, config) {
    nextBatchIndex = 0;
    prevHealth = state.health;
    prevCombo = 0;
    announcedMilestones = new Set();
    lastTimeInfo = config.mode === 'time' ? `${config.duration} seconds remaining.` : '';
  }

  // Called once the test screen is actually visible and ready to be typed into.
  function announceReady(state, config) {
    const words = computeWords(state.text).slice(0, BATCH_SIZE);
    if (!words.length) return;
    const mode = TC_DATA.modes.find(m => m.id === config.gameMode);
    const modePrefix = mode && mode.id !== 'classic' ? `${mode.label} mode. ` : '';
    announce(`${modePrefix}Ready. Type the following: ${words.map(w => w.text).join(' ')}`, false);
  }

  function onChar(state) {
    const words = computeWords(state.text);
    const batchEnd = nextBatchIndex + BATCH_SIZE - 1;
    if (batchEnd >= words.length) return;
    const boundaryWord = words[batchEnd];
    if (state.currentIndex < boundaryWord.end) return;

    let correctWords = 0;
    for (let w = nextBatchIndex; w <= batchEnd; w++) {
      const word = words[w];
      let wordCorrect = true;
      for (let i = word.start; i < word.end; i++) {
        const t = state.typed[i];
        if (!t || !t.correct) { wordCorrect = false; break; }
      }
      if (wordCorrect) correctWords++;
    }
    const wordsInBatch = batchEnd - nextBatchIndex + 1;

    nextBatchIndex += BATCH_SIZE;
    const nextWords = words.slice(nextBatchIndex, nextBatchIndex + BATCH_SIZE);

    const parts = [
      `${correctWords} of ${wordsInBatch} words correct.`,
      `${state.liveWpm} words per minute, ${state.liveAccuracy}% accuracy.`,
    ];
    if (lastTimeInfo) parts.push(lastTimeInfo);
    parts.push(nextWords.length ? `Next: ${nextWords.map(w => w.text).join(' ')}` : 'That was the last of the text.');

    announce(parts.join(' '), false);
  }

  function onTick(event, config) {
    if (config.mode === 'time') {
      const remaining = Math.ceil(event.remaining);
      lastTimeInfo = `${remaining} second${remaining === 1 ? '' : 's'} remaining.`;
      if (TIME_MILESTONES.includes(remaining) && !announcedMilestones.has(remaining)) {
        announcedMilestones.add(remaining);
        announce(lastTimeInfo, false);
      }
    } else {
      const elapsed = Math.ceil(event.elapsed);
      lastTimeInfo = `${elapsed} second${elapsed === 1 ? '' : 's'} elapsed.`;
    }
  }

  function onHealth(health, maxHealth) {
    if (prevHealth !== null && health < prevHealth) {
      announce(`Life lost. ${health} of ${maxHealth} lives remaining.`, true);
    }
    prevHealth = health;
  }

  function onCombo(combo, maxCombo) {
    if (combo === 0 && prevCombo >= STREAK_BREAK_THRESHOLD) {
      announce(`Streak broken at ${prevCombo}.`, true);
    }
    prevCombo = combo;
  }

  function onStage(stage) {
    announce(`Stage ${stage}: ${STAGE_LABELS[stage] || ''} difficulty.`, false);
  }

  function onTextExtended() {
    announce('More text added.', false);
  }

  function onFinish(result) {
    const failed = result.modeExtras && result.modeExtras.finishReason && result.modeExtras.finishReason !== 'completed';
    const outcome = failed ? 'Run ended.' : 'Test complete.';
    announce(`${outcome} ${result.wpm} words per minute, ${result.accuracy} percent accuracy.`, true);
  }

  return {
    announce, resetState, announceReady, onChar, onTick,
    onHealth, onCombo, onStage, onTextExtended, onFinish,
  };
})();
