# Polyphony Player

Play multi-voice choral scores voice by voice, and practise singing your part with live pitch feedback and a score.

## Run it

1. Open `index.html` in Chrome or Edge.
2. If the browser doesn't ask for the microphone in singing mode, open a terminal in this folder, run
   `python3 -m http.server`, and open http://localhost:8000/ instead.
3. Use headphones when singing.

## Getting a score in

- Ask Claude in chat: send a picture of the notes and paste the JSON it gives you into the Transcription box, then press Apply.
- MusicXML exported from notation software (`.musicxml`, `.mxl`) loads directly with Read score.
- Read score can also read a picture itself with an Anthropic API key.

## Editing and projects

Switch on **Editing mode** to change notes on the piano roll: drag to move notes in time and pitch, drag a note's right end to change its length, draw new notes, split notes, cut, copy, paste and delete, with undo. **Save project** keeps the score in this browser; open it again from the Project list. **Export file** saves it as a .json file for another browser or computer.

## Work on it with Claude

Open this folder in Claude on your computer. Claude reads `CLAUDE.md` first, which explains how the app is built.
