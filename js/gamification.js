const TC_Gamification = (() => {
  function calcXP(result) {
    const base = 10;
    const wpmBonus = Math.floor(result.wpm / 10) * 5;
    const accBonus = result.accuracy >= 95 ? 15 : result.accuracy >= 90 ? 8 : result.accuracy >= 80 ? 3 : 0;
    const streakBonus = 0; // applied separately
    return base + wpmBonus + accBonus + streakBonus;
  }

  function checkAchievements(result, storageData) {
    const newlyUnlocked = [];
    for (const ach of TC_DATA.achievements) {
      if (storageData.achievements.includes(ach.id)) continue;
      if (ach.check(result, storageData)) {
        const unlocked = TC_Storage.unlockAchievement(ach.id);
        if (unlocked) newlyUnlocked.push(ach);
      }
    }
    return newlyUnlocked;
  }

  function getLevelInfo(xp) {
    const levels = TC_DATA.levels;
    let current = levels[0];
    let next = levels[1];

    for (let i = 0; i < levels.length; i++) {
      if (xp >= levels[i].xpRequired) {
        current = levels[i];
        next = levels[i + 1] || null;
      }
    }

    const progress = next
      ? Math.round(((xp - current.xpRequired) / (next.xpRequired - current.xpRequired)) * 100)
      : 100;

    return { current, next, progress, xp };
  }

  function getSkillLevel(avgWpm) {
    if (avgWpm < 30) return 'Beginner';
    if (avgWpm < 50) return 'Intermediate';
    if (avgWpm < 75) return 'Proficient';
    if (avgWpm < 100) return 'Advanced';
    return 'Expert';
  }

  return { calcXP, checkAchievements, getLevelInfo, getSkillLevel };
})();
