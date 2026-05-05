const TC_Metrics = (() => {
  function calcWPM(correctChars, elapsedSeconds) {
    if (elapsedSeconds < 0.5) return 0;
    return Math.round((correctChars / 5) / (elapsedSeconds / 60));
  }

  function calcRawWPM(totalChars, elapsedSeconds) {
    if (elapsedSeconds < 0.5) return 0;
    return Math.round((totalChars / 5) / (elapsedSeconds / 60));
  }

  function calcAccuracy(typed) {
    const entries = typed.filter(t => t !== null);
    if (!entries.length) return 100;
    const correct = entries.filter(t => t.correct).length;
    return Math.round((correct / entries.length) * 100);
  }

  function calcErrors(typed) {
    return typed.filter(t => t && !t.correct).length;
  }

  function buildResult(engineState, config) {
    const { typed, startTime, endTime, keyErrors, correctedErrors } = engineState;
    const elapsed = (endTime - startTime) / 1000;
    const correctChars = typed.filter(t => t && t.correct).length;
    const totalTyped = typed.filter(t => t !== null).length;
    const rawErrors = calcErrors(typed);

    return {
      id: Date.now(),
      date: new Date().toISOString(),
      wpm: calcWPM(correctChars, elapsed),
      rawWpm: calcRawWPM(totalTyped, elapsed),
      accuracy: calcAccuracy(typed),
      errors: rawErrors,
      correctedErrors,
      duration: Math.round(elapsed),
      mode: config.mode,
      duration_setting: config.mode === 'time' ? config.duration : config.wordCount,
      difficulty: config.difficulty,
      textType: config.textType,
      gameMode: config.gameMode || 'classic',
      keyErrors: { ...keyErrors },
      wpmHistory: engineState.wpmHistory || [],
      modeExtras: {
        health: engineState.health,
        maxCombo: engineState.maxCombo || 0,
        charsTyped: engineState.currentIndex,
        finishReason: engineState.finishReason || 'completed',
        progressiveStage: engineState.progressiveStage || 1,
      }
    };
  }

  return { calcWPM, calcRawWPM, calcAccuracy, calcErrors, buildResult };
})();
