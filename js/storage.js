const TC_Storage = (() => {
  const KEY = 'typingcoach_v1';

  const defaults = () => ({
    tests: [],
    totalTests: 0,
    personalBest: { wpm: 0, accuracy: 0 },
    streak: { count: 0, lastDate: null },
    xp: 0,
    level: 1,
    achievements: [],
    weakKeys: {},
    goals: { dailyTests: 10, lastDate: null, todayCount: 0 }
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      return Object.assign(defaults(), JSON.parse(raw));
    } catch {
      return defaults();
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // Storage full or unavailable
    }
  }

  function addTest(testResult) {
    const data = load();
    const today = new Date().toDateString();

    // Keep last 200 tests
    data.tests.unshift(testResult);
    if (data.tests.length > 200) data.tests.pop();

    data.totalTests++;

    if (testResult.wpm > data.personalBest.wpm) {
      data.personalBest.wpm = testResult.wpm;
    }
    if (testResult.accuracy > data.personalBest.accuracy) {
      data.personalBest.accuracy = testResult.accuracy;
    }

    // Update daily goals
    if (data.goals.lastDate !== today) {
      data.goals.lastDate = today;
      data.goals.todayCount = 1;
    } else {
      data.goals.todayCount++;
    }

    // Update streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toDateString();

    if (data.streak.lastDate === today) {
      // Same day, no change
    } else if (data.streak.lastDate === yStr) {
      data.streak.count++;
      data.streak.lastDate = today;
    } else if (data.streak.lastDate === null || data.streak.lastDate !== today) {
      data.streak.count = 1;
      data.streak.lastDate = today;
    }

    // Update weak keys
    if (testResult.keyErrors) {
      for (const [key, count] of Object.entries(testResult.keyErrors)) {
        data.weakKeys[key] = (data.weakKeys[key] || 0) + count;
      }
    }

    save(data);
    return data;
  }

  function updateXP(xp) {
    const data = load();
    data.xp += xp;
    data.level = getLevelFromXP(data.xp);
    save(data);
    return data;
  }

  function unlockAchievement(id) {
    const data = load();
    if (!data.achievements.includes(id)) {
      data.achievements.push(id);
      save(data);
      return true;
    }
    return false;
  }

  function getLevelFromXP(xp) {
    const levels = TC_DATA.levels;
    let level = 1;
    for (const l of levels) {
      if (xp >= l.xpRequired) level = l.level;
      else break;
    }
    return level;
  }

  function getRecentTests(n = 20) {
    const data = load();
    return data.tests.slice(0, n);
  }

  function getTodayTestCount() {
    const data = load();
    const today = new Date().toDateString();
    return data.goals.lastDate === today ? data.goals.todayCount : 0;
  }

  function getWeakKeys(top = 5) {
    const data = load();
    return Object.entries(data.weakKeys)
      .sort((a, b) => b[1] - a[1])
      .slice(0, top)
      .map(([key, count]) => ({ key, count }));
  }

  function getAvgWPM(n = 10) {
    const data = load();
    const recent = data.tests.slice(0, n);
    if (!recent.length) return 0;
    return Math.round(recent.reduce((s, t) => s + t.wpm, 0) / recent.length);
  }

  function clearAll() {
    localStorage.removeItem(KEY);
  }

  return { load, save, addTest, updateXP, unlockAchievement, getLevelFromXP, getRecentTests, getTodayTestCount, getWeakKeys, getAvgWPM, clearAll };
})();
