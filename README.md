# Rapid Reader (Obsidian Plugin)

Rapid Reader is a focused popup-style speed-reading plugin for Obsidian. It reads Markdown and plain text content one token at a time with ORP (Optimal Recognition Point) highlighting.

## Features

- Popup modal reading experience (distraction-free)
- ORP-aligned one-word display with configurable center guide
- Reads selected editor text or current file content
- File picker for `.md`, `.txt`, and README-like files
- Readability preflight warning flow with Simplify / Continue / Cancel
- Deterministic text cleanup and simplify pipeline
- Side panel with cleaned full text and live paragraph highlight
- Playback controls: restart, step, jump ±10, speed slider, progress slider
- Keyboard shortcuts inside modal
- Persistent settings and remembered position per file
- Speed shown as `w/min` below the speed slider and reading progress shown as `current/total`

## Version 1 limitations

Not included in v1:
- PDF support
- LLM summarization
- Caveman simplification mode
- Web page/URL ingestion
- EPUB support
- OCR

## Development installation

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Test in an Obsidian vault

1. Build the plugin (`npm run build`).
2. Create a vault plugin folder: `<vault>/.obsidian/plugins/rapid-reader/`.
3. Copy these files into that folder:
   - `main.js`
   - `manifest.json`
   - `styles.css`
4. Open Obsidian → Settings → Community plugins.
5. Enable Rapid Reader.

## Commands

- **Open Rapid Reader for current file**
- **Choose file for Rapid Reader**
- **Open Rapid Reader settings**
- Left-ribbon button opens a quick choice: current file or choose another file

## Keyboard shortcuts (inside reader modal)

- `Space`: Play/Pause
- `Left`: Previous word
- `Right`: Next word
- `Shift + Left`: Back 10 words
- `Shift + Right`: Forward 10 words
- `Up`: +25 WPM
- `Down`: -25 WPM
- `[`: -50 WPM
- `]`: +50 WPM
- `R`: Restart
- `H`: Open help
- `,`: Open settings tab
- `Esc`: Close reader

## Settings

- Default WPM (default `500`)
- Minimum WPM (default `100`)
- Maximum WPM mode (`normal=1200`, `advanced=2000`)
- Font size (default `48`)
- Font family override
- ORP color (default red)
- Text color override
- Background color override
- Reader width
- Show center guide
- Show full text side panel by default
- Punctuation pause strength (`off/light/normal/strong`)
- Replace code blocks with `[code block]`
- Replace inline code with `[code]`
- Replace URLs with `[link]` during simplify
- Autoplay after preflight
- Remember last position per file
- Warn before reading low-readability docs

## Manual verification checklist

1. Open Markdown note and launch Rapid Reader.
2. Select text and launch Rapid Reader; only selected text loads.
3. Open file picker and choose a `.md` or `.txt` file.
4. Confirm code blocks become `[code block]`.
5. Confirm preflight warning appears for code-heavy or list-heavy notes.
6. Click Simplify and verify cleaned text still reads.
7. Click Continue and verify it opens without simplifying.
8. Click Cancel and verify modal closes.
9. Press Space to play/pause.
10. Use left/right arrows for previous/next word.
11. Use Shift + arrows for 10-word jumps.
12. Use up/down arrows to adjust speed.
13. Verify ORP letter stays centered.
14. Verify full text side panel scrolls with the current reading position.
15. Verify settings persist after reload.
16. Verify plugin unload leaves no running timers.

## Roadmap

- PDF support later
- Better Markdown parsing later
- Optional docked/tab view later
- Optional LLM summary mode later (not in version 1)

## Security notes

- No network calls for document text
- No note mutation/writes
- Uses safe text rendering APIs (`setText`/`textContent`) for user content
