# Polyphony Player

A one-file web app for practising Georgian (and other) polyphonic choral music.
It plays a score's voices together or one at a time, and has a singing mode that
listens to the microphone and scores how well you sing your part.

## Files

- `songs.json` — the song library the user version lists ({ songs: [score, …] }, first = default)
- `studio.html` — redirects to `index.html?studio`
- `index.html` — the whole app: HTML, CSS and JavaScript in one file, no build step. Open it in Chrome or Edge.
- `scores/` — example transcriptions in the app's JSON format (paste one into the "Transcription" box and press Apply):
  - `aghdgomasa-shensa.json` — Easter hymn, 3 voices (the built-in example)
  - `ceduri-mravaljamier.json` — Many Years, 3 staves with a divided bass in bars 4–6
- `tests/` — checks the user may run (`npm install`, `npm run setup`, `npm test`):
  - `pitch-test.js` — the pitch detector and smoothing on synthetic held notes with disturbances
  - `sing-test.js` — singing mode end to end in Chromium, with a simulated singer instead of the microphone
  - `serve.js` — tiny static server used by the tests

The user tests changes themselves. Don't run the tests or a browser unless they ask.

## How index.html is organised (search for the `/* ---------- ... ---------- */` markers)

- `EXAMPLE` (between `/*DATA*/` and `/*END*/`) — built-in score
- `PROMPT` — instructions sent to Claude to transcribe a score picture into the JSON format
- parsing and checking — `normalizePiece`: parses `NOTE:BEATS` tokens, splits stacked notes (`G3+G2:4`) into separate parts, pads bars that don't add up
- engine state / `buildPiece` — turns a piece into `events` ({v, midi, start, dur} in beats), bar starts, fermatas, breaths
- position — cursor, seeking, status line
- audio — Web Audio synth voices (`startPlay`, `stopAudio`, `pausePlay`, `seekTo`, `tick`)
- score view — piano roll on a canvas that scrolls sideways (`geo`, `draw`); press and drag to move the playhead (`scrubStart`/`scrubEnd`; playback pauses while dragging and resumes on release; in editing mode only on the bar numbers or the playhead line, `inScrubZone`)
- transport — Play / Pause / Resume button and the Space key (`togglePlay`)
- singing mode — microphone (`ensureMic`), pitch detection (CREPE neural network via TensorFlow.js: `loadCrepe`, `crepeFrame`, `crepeRun`, `crepeDecode`, `pumpPitch`; `detectPitch` McLeod as offline fallback), steadying (`stablePitch`, time-based), comparison with the chosen part (`singStep`), live meter (`showLive`; when stopped, `listenLoop` keeps it live against the part's note at the cursor, or the nearest note where the part rests), drawn line (`drawSinging`), scoring (`singScore`, `singFinish`)
- MusicXML import (Read score, MusicXML files only) — `musicXmlText` (unzips .mxl), `musicXmlToRaw` (each staff voice → a part, chords → stacked notes, ties merged in a bar, clef 8 → octaveShift), `joinPages`
- editing mode — `ed` state, `edFromPiece` (parts → note lists in plain beats without pauses, ties merged), `edToRaw` (back to bar strings, notes crossing a bar line tied with `~`, a later note cuts the earlier one), `edChange` (undo snapshot + `edRefresh`, which rebuilds the piece and keeps position/mutes/volumes), `edCarve` (moved/pasted/drawn notes cut away what they cover), pointer handlers on the canvas, `drawEdit` (draw() calls it instead of the playback notes; lanes get a fixed px per semitone via `edRanges`/`edLaneH`), keyboard shortcuts
- projects — saved in localStorage `pp.projects` ({id: {name, savedAt, raw}}); `projSave`, `projOpen`, export/import .json
- reading a picture — SVG files are drawn to a 2000 px PNG first (`svgToPng`), since Claude only reads raster images; uses Claude's `sample` capability when running inside Claude, otherwise the Anthropic API with a key the user pastes (stored in localStorage as `pp.apiKey`)

## Score JSON format

```json
{ "title": "...", "subtitle": "...", "tempo": 72, "repeatTimes": 1, "transpose": 0, 
  "voices": [ { "name": "Tenor I", "octaveShift": -12, "lyricsTimed": [{"t": 4, "d": 4, "text": "Mra-"}], "bars": ["E5:.5 E5:.5 E5:1.5 C#5:.5 D5:1", "..."] } ],
  "breathAfter": [2], "fermataBars": [9], "lyrics": ["agh-dgo-ma-sa", "..."] }
```
Pitches as written on the staff; `octaveShift: -12` for treble-8 (tenor) clefs; beats in quarter notes; `r` is a rest; `+` joins stacked notes; a trailing `~` (e.g. `E4:1~`) ties the note into the next note of the same pitch (used by editing mode for notes crossing a bar line).

## Decisions and history

- Recording analysis (audio/video → notes) was built, tested on a real Georgian Voices recording, and then removed at the user's request. Don't bring it back unless asked.
- Only the piano roll view remains (a staff view was removed on request).
- Play is a Play / Pause / Resume button; resuming keeps muted voices as they are. Space toggles it everywhere except while typing.
- Singing mode runs only outside Claude: pages published in Claude can't use the microphone. A published copy without singing mode also exists in the user's Claude artifacts ("Polyphony Player").
- Pitch detection (Nov 2026): CREPE "tiny" model (ml5-data-and-models, pinned commit, loaded from raw.githubusercontent.com with jsDelivr as backup; TensorFlow.js 4.22.0 from jsDelivr/unpkg) when singing mode is switched on. It needs internet and a GPU backend; if loading fails, there is no GPU or inference takes >30 ms, the McLeod detector (`detectPitch`) is used and the panel says so (`pdInfo`). CREPE confidence: start ≥0.5, keep ≥0.35. Readings run async (`pumpPitch` → `feedPitch` → `stablePitch`), and `sing.sungAt` is used for latency compensation. Steadying is time-based: a leap must hold 60 ms (an exact octave or octave+fifth 120 ms). The meter display is smoothed, and the note names have hysteresis so they don't flicker. The user does all testing himself.
- Scoring: on pitch = within the Strictness setting (±75/50/30 cents), close = within twice that (half credit); the first 0.12 s of each note isn't scored; "Any octave" folds octaves.

## Style

Plain JavaScript, no frameworks. Colours are CSS variables on `:root` with dark-mode overrides. Keep the app a single file.

- Transcriptions (Nov 2026): the user gets score JSON by sending pictures to Claude in chat and pasting the result in. The Audiveris helper was built and then removed at his request; don't bring it back unless asked.
- Editing mode (Nov 2026): a mode like singing mode (they exclude each other). Tools: Select/Draw/Split, grid snapping, pitch up/down, cut/copy/paste/delete, undo/redo, add/remove last bar, insert/remove pause at the playhead (`edInsertPause`/`edRemovePause`: silence in all parts, later notes shift, the bar gets longer, a sounding note is split); projects saved in the browser.
- Transpose (Nov 2026): "transpose" in the score (−12..12 semitones, optional) is added to every part's octaveShift in `normalizePiece`, so playback, roll and singing targets move; written notes stay. Control in the editing-mode toolbar, `setTranspose` (in editing mode it is an undoable edit; edit parts' `shift` includes it and `edToRaw` subtracts it). Saved with projects.
- Note names in editing mode (labels on notes, octave labels on the semitone guides, the "Selected" line) show the sounding pitch: written + octaveShift + transpose, so they match what is heard and the singing meter.
- Sing to edit (Nov 2026, editing mode): `recStart` (mic via `ensureMic`, mutes the part, count-in clicks, plays from the range start), `recLoop` (pitch per frame via `pumpPitch`, latency-compensated position → plain beats), `recFinish` (Fix pitches: median sung pitch per note, keeping rhythm; New notes: median per grid step, same pitch merged, range replaced). Range = selected notes of the part, or from the playhead's bar until Stop/Space. "Match the part's octave" shifts the whole take by whole octaves. One undo step.
- Two versions (Nov 2026): `index.html` (hosted on GitHub Pages at iliakhaburdzania.github.io/poliphony-player) is the user version: song list from songs.json, listening, singing mode. `?studio` (studio.html) adds the studio-only panels (class `studio-only`: reading scores, editing mode + projects, transcription) and "Add to song library" (`libAdd`, downloads an updated songs.json for the user to commit). `STUDIO` flag, `loadLibrary`, `chooseSong`, `showLibrary`; the user version remembers the last song (localStorage `pp.song`). EXAMPLE (built-in default) is the user's Ceduri Mravaljamier version (transpose -2, 4 parts, tempo 72); keep it equal to the first song in songs.json. Transpose: in the studio in the editing toolbar (`keyDown/keyUp/keyOut`); in the user version a second control in the playback bar (`keyDown2/keyUp2/keyOut2`, class `user-only`; double-click returns to the song's published key; not saved).
- Parts carry `src` (transcription voice index; stacked notes split one voice into several parts). Clicking/caret in the Transcription box (`jsonCaretBar`) highlights that bar (`hiBar`) and moves the playhead. (A click-a-note bar editor existed briefly and was replaced by lyric editing at the user's request.)
- Lyrics on the notes (Nov 2026): every part has its own timed lyrics, `voices[i].lyricsTimed: [{t, d, text}]` in plain beats (no pauses); an older top-level `lyricsTimed` is read as the first part's. Parts without them get the per-bar `lyrics` spread over their own note starts (`lyDerive`); `lyrics` (per bar) follows the first part (`lyPerBar`). Drawn above each part's notes, each word in a bordered box exactly as long as it lasts (`drawLyrics`, height from `lyBase`, 18 px above the note; lanes get `lyPad()` extra room at the top when there are lyrics; only the box grabs a word, its right edge resizes, so notes stay clickable; current word coloured while playing, both versions). Studio: click a word → editor (`lyOpen`, Enter applies + next), drag the box's right edge = duration of that word only (the next word never moves; it can grow up to the next word's start), drag the word = move (a joined previous word ends where it now starts, a joined next word starts where it now ends), double-click empty space in a lane = add; all via `lyCommit(part, fn)` (undo step in editing mode, where parts keep `lyr`). Pause insert/remove and bar removal keep lyrics in step. (Earlier a separate Lyrics line under the voices was used; replaced at the user's request.)
- Publishing: `.nojekyll` makes GitHub Pages serve the files as they are (no Jekyll). `BUILD` (near the end of the script) is shown in the header; update it with every change so the user can tell which version a browser has.
- Saving (Nov 2026, studio): one Save button (Ctrl+S) writes the current song into songs.json in the app folder via the File System Access API (`songSave`, `songsFile`; the file handle is kept in IndexedDB "polyphony"/kv/songsFile, the browser asks for the file once and later only for permission). The studio reads its song list from that file (`studioLibrary`, "Open songs.json" button when permission must be re-granted). The user then commits and pushes to publish. Song replaced by the key it was opened with (`songKeyLoaded`), else by title. Projects/export/import/"Add to song library" UI is hidden (code kept; `libAdd` is the fallback for browsers without the API). The user explicitly does NOT want Save to push to GitHub.
- Words are edited only in editing mode (`lyHit` requires `ed.on`), so every word change is an undo step; with a word selected: ←/→ (`lyNudge`), Delete, Esc; Ctrl+Z/Y work inside the word box when there is no unapplied typing.
- The player opened from the folder (file://) can't fetch songs.json, so `loadLibrary` reads it through the studio's stored file link (`songsFile(false)`; a "Show saved songs" button when the browser wants a click first). After the library loads, the player always loads the library's version of the song, even if the built-in EXAMPLE has the same title.
