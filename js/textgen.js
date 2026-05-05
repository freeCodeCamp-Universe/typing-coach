const TC_TextGen = (() => {
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function addPunctuation(words) {
    return words.map((w, i) => {
      const r = Math.random();
      if (i === words.length - 1) return w + '.';
      if (r < 0.08) return w + ',';
      if (r < 0.10) return w + '.';
      if (r < 0.12) return w + '!';
      if (r < 0.13) return w + '?';
      if (r < 0.14) return w + ';';
      return w;
    });
  }

  function capitalizeFirst(words) {
    return words.map((w, i) => {
      if (i === 0) return w.charAt(0).toUpperCase() + w.slice(1);
      const prev = words[i - 1];
      if (prev && /[.!?]$/.test(prev)) return w.charAt(0).toUpperCase() + w.slice(1);
      return w;
    });
  }

  function generateWords(config) {
    const pool = TC_DATA.words[config.difficulty] || TC_DATA.words.intermediate;
    const count = config.mode === 'words' ? config.wordCount : estimateWordCount(config.duration, config.difficulty);

    let words = [];
    const shuffled = shuffle(pool);
    while (words.length < count) {
      words = words.concat(shuffled);
    }
    words = words.slice(0, count);

    if (config.punctuation) {
      words = addPunctuation(words);
      words = capitalizeFirst(words);
    }

    return words.join(' ');
  }

  function generateSentences(config) {
    const sentences = shuffle([...TC_DATA.sentences]);
    const count = config.mode === 'words'
      ? Math.ceil(config.wordCount / 10)
      : Math.ceil(config.duration / 20);
    const selected = sentences.slice(0, Math.max(2, count));
    return selected.join(' ');
  }

  function generateCode(config) {
    const lang = Math.random() < 0.6 ? 'javascript' : 'python';
    const snippets = TC_DATA.code[lang];
    const count = config.mode === 'words' ? 2 : Math.ceil(config.duration / 30);
    const selected = shuffle(snippets).slice(0, Math.max(1, count));
    return selected.join('\n\n');
  }

  function generateFromWeakKeys(weakKeys) {
    if (!weakKeys.length) return generateWords({ difficulty: 'intermediate', mode: 'words', wordCount: 30, punctuation: false });
    const keys = weakKeys.map(k => k.key).filter(k => /[a-z]/.test(k));
    if (!keys.length) return generateWords({ difficulty: 'intermediate', mode: 'words', wordCount: 30, punctuation: false });

    const pool = TC_DATA.words.intermediate.concat(TC_DATA.words.beginner);
    const relevant = pool.filter(w => keys.some(k => w.includes(k)));
    const fill = TC_DATA.words.beginner;

    let words = shuffle(relevant).slice(0, 20);
    while (words.length < 30) words.push(pickRandom(fill));
    words = shuffle(words).slice(0, 30);
    return words.join(' ');
  }

  function generateProgressive(config) {
    const total = config.mode === 'words'
      ? config.wordCount
      : estimateWordCount(config.duration, 'intermediate');
    const third = Math.floor(total / 3);
    const rest = total - third * 2;

    const bWords = shuffle(TC_DATA.words.beginner).slice(0, third);
    const iWords = shuffle(TC_DATA.words.intermediate).slice(0, third);
    const aWords = shuffle(TC_DATA.words.advanced).slice(0, rest);

    const iWithPunct = capitalizeFirst(addPunctuation(iWords));
    const aWithPunct = capitalizeFirst(addPunctuation(aWords));

    return [...bWords, ...iWithPunct, ...aWithPunct].join(' ');
  }

  function generate(config) {
    if (config.specialText === 'progressive') return generateProgressive(config);
    if (config.specialText === 'weak-keys') {
      const weakKeys = typeof TC_Storage !== 'undefined' ? TC_Storage.getWeakKeys(5) : [];
      return generateFromWeakKeys(weakKeys);
    }
    switch (config.textType) {
      case 'sentences': return generateSentences(config);
      case 'code': return generateCode(config);
      case 'numbers': return TC_DATA.numberText;
      case 'symbols': return TC_DATA.symbolText;
      default: return generateWords(config);
    }
  }

  function estimateWordCount(durationSeconds, difficulty) {
    const wpmEstimate = difficulty === 'beginner' ? 30 : difficulty === 'intermediate' ? 50 : 70;
    return Math.ceil((wpmEstimate * durationSeconds) / 60) + 10;
  }

  return { generate, generateFromWeakKeys };
})();
