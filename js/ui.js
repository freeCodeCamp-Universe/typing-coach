const TC_UI = (() => {
  // -- Screen management --
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('screen-' + id).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.screen === id);
    });
  }

  // -- Text display --
  function renderTextDisplay(text) {
    const el = document.getElementById('text-display');
    el.innerHTML = text.split('').map((ch, i) =>
      `<span class="char" data-index="${i}">${ch === ' ' ? '&nbsp;' : ch === '\n' ? '<br>' : ch}</span>`
    ).join('');
  }

  function updateCharAt(index, state) {
    const span = document.querySelector(`#text-display .char[data-index="${index}"]`);
    if (!span) return;
    const t = state.typed[index];
    span.className = 'char';
    if (t === null) {
      if (index === state.currentIndex) span.classList.add('cursor');
    } else {
      span.classList.add(t.correct ? 'correct' : 'incorrect');
    }
  }

  function refreshDisplay(state) {
    const spans = document.querySelectorAll('#text-display .char');
    spans.forEach((span, i) => {
      span.className = 'char';
      const t = state.typed[i];
      if (i === state.currentIndex) {
        span.classList.add('cursor');
      } else if (t) {
        span.classList.add(t.correct ? 'correct' : 'incorrect');
      }
    });
    scrollCursorIntoView();
  }

  function scrollCursorIntoView() {
    const cursor = document.querySelector('#text-display .cursor');
    if (cursor) cursor.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // -- Live metrics --
  function updateLiveMetrics(state) {
    document.getElementById('live-wpm').textContent = state.liveWpm;
    document.getElementById('live-accuracy').textContent = state.liveAccuracy;
  }

  function updateTimer(remaining, mode) {
    const el = document.getElementById('timer-display');
    if (mode === 'time') {
      el.textContent = Math.ceil(remaining);
      el.classList.toggle('timer-warning', remaining <= 10);
    } else {
      el.textContent = typeof remaining === 'number' ? remaining.toFixed(1) + 's' : remaining;
    }
  }

  function updateProgressBar(value) {
    document.getElementById('progress-bar').style.width = Math.min(100, value * 100) + '%';
  }

  // -- Results screen --
  function renderResults(result, analysis, newAchievements, xpGained) {
    document.getElementById('result-wpm').textContent = result.wpm;
    document.getElementById('result-accuracy').textContent = result.accuracy + '%';
    document.getElementById('result-errors').textContent = result.errors;
    document.getElementById('result-raw-wpm').textContent = result.rawWpm;
    document.getElementById('result-time').textContent = result.duration + 's';

    const xpEl = document.getElementById('xp-gain-display');
    xpEl.textContent = '+' + xpGained + ' XP';
    xpEl.className = 'xp-gain animated';

    renderAnalysis(analysis);
    renderNewAchievements(newAchievements);

    if (result.wpmHistory && result.wpmHistory.length > 1) {
      setTimeout(() => drawWpmChart(result.wpmHistory), 50);
    }
  }

  function renderAnalysis(analysis) {
    const el = document.getElementById('results-analysis');
    if (!analysis || !analysis.insights.length) { el.innerHTML = ''; return; }

    let html = '<div class="analysis-section"><h4>Insights</h4><ul class="insights-list">';
    html += analysis.insights.map(i => `<li>${i}</li>`).join('');
    html += '</ul>';

    if (analysis.topErrors.length) {
      html += '<div class="error-keys"><h4>Most Missed Keys</h4><div class="error-key-list">';
      html += analysis.topErrors.map(e =>
        `<span class="error-key-badge"><kbd>${e.key === ' ' ? 'Space' : e.key}</kbd><span class="err-count">${e.count}</span></span>`
      ).join('');
      html += '</div></div>';
    }

    html += '<div class="consistency-wrap"><span class="consistency-label">Consistency</span>';
    html += `<div class="consistency-bar"><div class="consistency-fill" style="width:${analysis.consistencyScore}%"></div></div>`;
    html += `<span class="consistency-score">${analysis.consistencyScore}%</span></div>`;

    html += '</div>';
    el.innerHTML = html;
  }

  function renderNewAchievements(achievements) {
    const el = document.getElementById('new-achievements');
    if (!achievements || !achievements.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="new-ach-header">Achievements Unlocked!</div>' +
      achievements.map(a =>
        `<div class="ach-badge new"><span class="ach-icon">${a.icon}</span><span class="ach-label">${a.label}</span></div>`
      ).join('');
  }

  // -- Canvas charts --
  function drawWpmChart(data) {
    const canvas = document.getElementById('wpm-chart');
    if (!canvas) return;
    const container = canvas.parentElement;
    canvas.width = container.clientWidth || 600;
    canvas.height = 120;
    drawLineChart(canvas, data, { color: '#7aa2f7', label: 'WPM' });
  }

  function drawProgressChart(tests) {
    const canvas = document.getElementById('progress-chart');
    if (!canvas) return;
    const container = canvas.parentElement;
    canvas.width = container.clientWidth || 800;
    canvas.height = 160;
    const data = [...tests].reverse().map(t => t.wpm);
    drawLineChart(canvas, data, { color: '#9ece6a', label: 'WPM History' });
  }

  function drawLineChart(canvas, data, { color = '#7aa2f7' } = {}) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pad = { top: 15, right: 20, bottom: 30, left: 45 };
    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim() || '#24283b';
    ctx.fillRect(0, 0, W, H);

    if (!data.length) return;

    const maxVal = Math.max(...data, 1);
    const minVal = 0;
    const range = maxVal - minVal || 1;

    const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#3b4261';
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim() || '#565f89';

    // Grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (cH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cW, y); ctx.stroke();
      const val = Math.round(maxVal - (range * i / 4));
      ctx.fillStyle = textColor;
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val, pad.left - 6, y + 4);
    }

    // X-axis labels
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(data.length / 6));
    for (let i = 0; i < data.length; i += step) {
      const x = pad.left + (i / Math.max(data.length - 1, 1)) * cW;
      ctx.fillText((i + 1) + 's', x, H - 6);
    }

    // Line path
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    data.forEach((val, i) => {
      const x = pad.left + (i / Math.max(data.length - 1, 1)) * cW;
      const y = pad.top + (1 - (val - minVal) / range) * cH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill
    ctx.fillStyle = color + '28';
    data.forEach((val, i) => {
      const x = pad.left + (i / Math.max(data.length - 1, 1)) * cW;
      const y = pad.top + (1 - (val - minVal) / range) * cH;
      if (i === 0) { ctx.beginPath(); ctx.moveTo(x, y); }
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.left + cW, pad.top + cH);
    ctx.lineTo(pad.left, pad.top + cH);
    ctx.closePath();
    ctx.fill();
  }

  // -- Progress screen --
  function renderProgressScreen() {
    const data = TC_Storage.load();
    const tests = data.tests;

    document.getElementById('prog-best-wpm').textContent = data.personalBest.wpm;
    document.getElementById('prog-avg-wpm').textContent = TC_Storage.getAvgWPM(20);
    document.getElementById('prog-best-acc').textContent = data.personalBest.accuracy + '%';
    document.getElementById('prog-total-tests').textContent = data.totalTests;

    if (tests.length >= 2) {
      setTimeout(() => drawProgressChart(tests.slice(0, 30)), 50);
    }

    renderAchievementsGrid(data.achievements);
    renderHistoryTable(tests.slice(0, 20));
    renderLevelBar(data.xp, data.level);
  }

  function renderLevelBar(xp, level) {
    const info = TC_Gamification.getLevelInfo(xp);
    const el = document.getElementById('level-bar-wrap');
    if (!el) return;
    el.innerHTML = `
      <div class="level-info">
        <span class="level-label">Level ${info.current.level} · ${info.current.title}</span>
        <span class="xp-label">${xp} XP${info.next ? ' / ' + info.next.xpRequired : ''}</span>
      </div>
      <div class="level-bar"><div class="level-fill" style="width:${info.progress}%"></div></div>
      ${info.next ? `<div class="level-next">Next: Level ${info.next.level} · ${info.next.title}</div>` : '<div class="level-next">Max Level!</div>'}
    `;
  }

  function renderAchievementsGrid(unlocked) {
    const el = document.getElementById('achievements-grid');
    el.innerHTML = TC_DATA.achievements.map(a => `
      <div class="ach-card ${unlocked.includes(a.id) ? 'unlocked' : 'locked'}" title="${a.desc}">
        <div class="ach-icon">${a.icon}</div>
        <div class="ach-label">${a.label}</div>
        <div class="ach-desc">${a.desc}</div>
      </div>
    `).join('');
  }

  function renderHistoryTable(tests) {
    const tbody = document.getElementById('history-body');
    if (!tests.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No tests yet. Start typing!</td></tr>';
      return;
    }
    tbody.innerHTML = tests.map(t => `
      <tr>
        <td>${formatDate(t.date)}</td>
        <td class="wpm-cell">${t.wpm}</td>
        <td>${t.accuracy}%</td>
        <td>${t.errors}</td>
        <td>${t.mode === 'time' ? t.duration_setting + 's' : t.duration_setting + 'w'}</td>
      </tr>
    `).join('');
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // -- Home screen --
  function renderHomeStats() {
    const data = TC_Storage.load();
    document.getElementById('qs-best-wpm').textContent = data.personalBest.wpm;
    document.getElementById('qs-avg-acc').textContent = data.personalBest.accuracy + '%';
    document.getElementById('qs-tests').textContent = TC_Storage.getTodayTestCount();
    document.getElementById('qs-streak').textContent = data.streak.count;
    document.getElementById('qs-level').textContent = data.level;
  }

  // -- Practice screen --
  function renderPracticeScreen() {
    const weakKeys = TC_Storage.getWeakKeys(8);
    const el = document.getElementById('weak-keys-display');
    if (!weakKeys.length) {
      el.innerHTML = '<p class="dim-text">Complete some tests to identify your weak keys.</p>';
      return;
    }
    el.innerHTML = '<div class="weak-key-list">' +
      weakKeys.map(k => `
        <div class="weak-key-item">
          <kbd class="weak-key">${k.key === ' ' ? 'Space' : k.key}</kbd>
          <div class="weak-key-bar-wrap">
            <div class="weak-key-bar" style="width:${Math.min(100, k.count * 5)}%"></div>
          </div>
          <span class="weak-key-count">${k.count} errors</span>
        </div>
      `).join('') +
      '</div>';
  }

  // -- Config toggles --
  function bindToggleGroup(groupId, onChange) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.addEventListener('click', e => {
      const btn = e.target.closest('.toggle-btn');
      if (!btn) return;
      group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onChange(btn.dataset.value);
    });
  }

  return {
    showScreen, renderTextDisplay, updateCharAt, refreshDisplay,
    updateLiveMetrics, updateTimer, updateProgressBar,
    renderResults, renderProgressScreen, renderHomeStats, renderPracticeScreen,
    drawWpmChart, bindToggleGroup, renderLevelBar
  };
})();
