const TC_Analysis = (() => {
  function analyzeTest(result) {
    const { keyErrors, wpmHistory, accuracy, wpm, correctedErrors } = result;

    const topErrors = Object.entries(keyErrors || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => ({ key, count }));

    const consistencyScore = calcConsistency(wpmHistory);
    const trend = calcTrend(wpmHistory);
    const hesitationKeys = detectHesitation(result);

    const insights = buildInsights({ topErrors, consistencyScore, trend, accuracy, wpm, correctedErrors, hesitationKeys });

    return { topErrors, consistencyScore, trend, hesitationKeys, insights };
  }

  function calcConsistency(wpmHistory) {
    if (!wpmHistory || wpmHistory.length < 3) return 100;
    const avg = wpmHistory.reduce((s, v) => s + v, 0) / wpmHistory.length;
    if (avg === 0) return 100;
    const variance = wpmHistory.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / wpmHistory.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avg;
    return Math.max(0, Math.round((1 - cv) * 100));
  }

  function calcTrend(wpmHistory) {
    if (!wpmHistory || wpmHistory.length < 4) return 'stable';
    const half = Math.floor(wpmHistory.length / 2);
    const firstHalf = wpmHistory.slice(0, half);
    const secondHalf = wpmHistory.slice(half);
    const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
    const diff = avgSecond - avgFirst;
    if (diff > avgFirst * 0.05) return 'improving';
    if (diff < -avgFirst * 0.05) return 'slowing';
    return 'stable';
  }

  function detectHesitation(result) {
    if (!result.keyErrors) return [];
    const punctuationKeys = ['.', ',', '!', '?', ';', ':', '"', "'"];
    return Object.entries(result.keyErrors)
      .filter(([key]) => punctuationKeys.includes(key))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, count]) => ({ key, count }));
  }

  function buildInsights({ topErrors, consistencyScore, trend, accuracy, wpm, correctedErrors, hesitationKeys }) {
    const msgs = [];

    if (topErrors.length > 0) {
      const k = topErrors[0].key;
      msgs.push(`You frequently mistype <kbd>${k === ' ' ? 'Space' : k}</kbd> (${topErrors[0].count}x errors).`);
    }

    if (consistencyScore < 60) {
      msgs.push('Your speed fluctuates a lot. Try to maintain a steady rhythm.');
    } else if (consistencyScore >= 85) {
      msgs.push('Excellent consistency! Your speed stays steady throughout.');
    }

    if (trend === 'improving') {
      msgs.push('You picked up speed as the test went on. Good warm-up pattern.');
    } else if (trend === 'slowing') {
      msgs.push('Your speed dropped toward the end. Work on endurance.');
    }

    if (accuracy < 85) {
      msgs.push('Focus on accuracy over speed. Slow down and type deliberately.');
    } else if (accuracy >= 99) {
      msgs.push('Near-perfect accuracy! Try pushing your speed a bit more.');
    }

    if (correctedErrors > 5) {
      msgs.push(`You corrected ${correctedErrors} errors. Your self-correction instinct is good.`);
    }

    if (hesitationKeys.length > 0) {
      msgs.push(`You struggle with punctuation like <kbd>${hesitationKeys[0].key}</kbd>. Try punctuation practice mode.`);
    }

    if (wpm > 80 && accuracy >= 95) {
      msgs.push('Great overall performance! You\'re in the expert range.');
    }

    return msgs;
  }

  return { analyzeTest };
})();
