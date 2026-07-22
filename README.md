# Typing Coach

A browser-based typing practice app to help you improve your speed and accuracy. No installation required — open `index.html` and start typing.

## Game Modes

| Mode | Description |
|------|-------------|
| **Classic** | Standard free-typing test with backspace enabled. Pure speed measurement. |
| **Accuracy** | Same as Classic but accuracy is the primary score — precision over speed. |
| **No Backspace** | Backspace is disabled. Every keystroke is permanent, so commit before you type. |
| **Perfect Run** | One mistake ends the run immediately. Finish the full text without a single error to complete it. |
| **Survival** | Start with 5 lives. Each mistake costs one life — lose them all and the test ends. |
| **Burst** | A fixed 10-second sprint to measure your peak typing speed. Duration is locked. |
| **Endurance** | A 3-minute session to test sustained typing speed over time. Duration is locked. |
| **Progressive** | Words get progressively harder as you advance through the text — difficulty escalates automatically. |
| **Combo** | Build streaks of consecutive correct characters. Any error resets your combo counter. |
| **Weak Keys** | Generates text focused on your most-mistyped characters, pulled from your personal error history. |
| **Code** | Type real JavaScript and Python code snippets, including symbols and indentation. |

## Features

- **Flexible sessions** — Time-based (30 / 60 / 120 seconds) or word-count based (25 / 50 / 100 words)
- **Difficulty levels** — Beginner, Intermediate, and Advanced word lists
- **Text types** — Words, sentences, or code snippets
- **Progress tracking** — WPM history, accuracy trends, daily streaks, XP, and levels
- **Analytics** — WPM charts, weak key identification, and error analysis

## Getting Started

Open `index.html` in any modern browser. No build step, server, or dependencies needed.

## Keyboard Shortcuts

| Key     | Action          |
|---------|-----------------|
| `Tab`   | Restart test    |
| `Esc`   | Exit / go back  |
| `Enter` | Confirm prompt  |

## Tech Stack

- Vanilla JavaScript (modular, no framework)
- HTML5 + CSS3
- Canvas API for charts
- `localStorage` for persistence

## Project Structure

```
type-practice/
├── index.html        # App entry point and UI structure
├── css/
│   └── styles.css    # Styling and animations
└── js/
    ├── app.js        # Application controller, navigation, lifecycle
    ├── engine.js     # Core typing engine and game mode logic
    ├── data.js       # Word lists, difficulty data, game mode definitions
    ├── textgen.js    # Practice text generation
    ├── metrics.js    # WPM, accuracy, and error calculations
    ├── analysis.js   # Weak key detection and result insights
    ├── gamification.js  # XP, levels, and achievements
    ├── storage.js    # localStorage persistence layer
    └── ui.js         # View rendering and DOM updates
```

## License

Typing Coach is licensed under the BSD 3-Clause License. See `LICENSE`.