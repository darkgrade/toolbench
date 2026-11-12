# Toolbench video script: "Three habits for shorter meetings"

## Setup

A solo creator sits at a desk, centred in the frame, and films a short talking-head video, using Darkgrade Studio's voice control to set up, between takes and to wrap up. A mirrorless camera with a power-zoom lens is connected to Darkgrade Studio on a Mac: Movie Manual mode at 25 frames a second, shutter 1/50, aperture f/4, ISO 800, white balance in its colour-temperature mode at 5600 K, continuous autofocus with face detection on. Live view is on and the camera is not recording. Studio shows the histogram scope, with zebras off, focus peaking off and the camera's own on-screen display overlay on. The battery is at 80% and the card holds two older clips, `C0007.MP4` and `C0008.MP4`, with about 90 minutes of recording space left. No settings have been changed yet. The picture is evenly lit and slightly dark, with nothing clipped.

## Script

Each numbered line is one turn: everything said up to a natural pause, given to the model word for word. Lines in italics are stage directions and are never shown to the model. Requests are only made while setting up, between takes and after the takes. During a take the creator only talks to the audience, and ends the take by saying "Cut." on its own.

*— Before take 1 (not recording) —*

1. "What shutter speed should I use at 25 frames a second?"
2. "Set the aperture to f/5.6."
3. "Is my exposure okay?"
4. "Make it a bit brighter."
5. "A bit more."
6. "Show the waveform."
7. "Turn on zebras."
8. "Make it a bit warmer."
9. "Undo that."
10. "Zoom out a little."
11. "Turn on focus peaking."
12. "Focus on my face."
13. "Hide the camera's display."
14. "Start recording."

*— TAKE 1 begins (recording) —*

15. "Hello, and welcome back. Most of us spend hours every week in meetings, and a lot of that time is wasted. Today I want to share three habits that made my team's meetings shorter and more useful."
16. "The first habit is a written agenda. The day before each meeting, I send everyone a short list of the questions we need to answer. If I can't write that list, we probably don't need the meeting."
17. "It also means people arrive prepared. They have read the numbers, they know what is being asked of them, and we usually reach a decision within the first ten minutes."
18. "When I began doing this, about a third of our regular meetings simply disappeared from the calendar, and nobody missed them."
19. "Cut."

*— TAKE 1 ends. Between takes (not recording) —*

20. "Delete the last clip."
21. "How much battery is left?"
22. "Make it a bit darker."
23. "Roll camera."

*— TAKE 2 begins (recording) —*

24. "The second habit is a shorter guest list. I only invite the people who make the decision or do the work. Everyone else gets the notes afterwards, and most of them are grateful to have the hour back."
25. "The third habit is ending with names and dates. Before anyone leaves, we say out loud who is doing what, and by when. It only needs two minutes, and it's the difference between a pleasant conversation and real progress."
26. "None of this needs new software or a bigger budget. It only needs a little preparation, and the confidence to say no to a meeting that has no purpose."
27. "If one of these habits helps your team, let me know in the comments. Thank you for watching, and I'll see you next week."
28. "Cut."

*— TAKE 2 ends. After the takes (not recording) —*

29. "What's on the card?"
30. "Download the last two clips."
31. "Switch to photo mode."
32. "Take a photo."
33. "Turn off live view."

## Answer key

The key describes outcomes: where the camera and Studio are after the turn, compared with just before it. Which tools got them there is not scored.

How to read it:

- **Lookups are always fine.** Read-only calls (`get_camera_status`, `analyze_frame`, `get_frame`, `get_shooting_guidance`, `list_card_files`) never count against the model, on any turn, including the video itself. No turn requires one.
- **Answers are not checked for wording.** Any reasonable answer to a question passes. Where no tool can do what was asked (turn 20), the only rule is that the model must not say it did it.
- **Serious** mistakes ruin a take or the creator's work. **Minor** mistakes are a small adjustment missed or slightly off, a harmless extra, or a missing answer.
- Anything a row doesn't list is judged the same way. Recording started or stopped, a photo taken, or files downloaded when the turn didn't ask for it is serious on every turn. During a take (turns 15 to 18 and 24 to 27), so is any change to exposure, colour, zoom or the focus point. Any other unrequested change is minor.
- Amounts are ranges because the requests are relative; the direction is what matters most.
- Fixtures the harness returns: frame analysis reports a slightly dark, evenly lit picture with nothing clipped. The battery reads 80% throughout. Take 1 is saved as `C0009.MP4` when it ends (turn 19) and take 2 as `C0010.MP4` (turn 28), so at turns 29 and 30 the card holds, newest first: `C0010.MP4`, `C0009.MP4`, `C0008.MP4`, `C0007.MP4`. The photo from turn 32 is `DSC00042.JPG`.

| Turn | Said (short) | Expected outcome | Serious if | Minor if |
| --- | --- | --- | --- | --- |
| 1 | "What shutter speed should I use at 25 frames a second?" | Nothing changes. Any reasonable answer (1/50, which the camera is already set to). | Recording started, or a photo taken. | Shutter speed or anything else changed (it was a question). No answer. |
| 2 | "Set the aperture to f/5.6." | Aperture at f/5.6. Shutter and ISO stay where they are. | Recording started, or a photo taken. | Aperture unchanged, or at another value. Shutter, ISO or anything else changed as well. |
| 3 | "Is my exposure okay?" | Nothing changes. Any reasonable answer (a little dark, nothing clipped). | Recording started, or a photo taken. | Exposure or anything else changed (it was a question). No answer. |
| 4 | "Make it a bit brighter." | Picture a little brighter: about +0.3 to +0.7 stops, up to about +1 accepted. | Recording started, or a photo taken. | No change. Made darker. More than a stop. Shutter moved off 1/50. Colour or anything else changed. |
| 5 | "A bit more." | Brighter again by a similar step (the follow-up refers to turn 4, just before it). | Recording started, or a photo taken. | No change. Made darker. More than a stop. Shutter moved off 1/50. Something other than exposure changed. |
| 6 | "Show the waveform." | Studio shows the waveform scope. | Recording started, or a photo taken. | Scope not on the waveform. Zebras, peaking, the camera's display or a camera setting changed. |
| 7 | "Turn on zebras." | Zebras on in Studio. The scope stays on the waveform. | Recording started, or a photo taken. | Zebras still off. Scope, peaking, the camera's display or a camera setting changed. |
| 8 | "Make it a bit warmer." | Colour temperature a little higher: about +300 to +500 K, anything up to +1000 K accepted. | Recording started, or a photo taken. | No change. Made cooler. More than +1000 K. White balance switched to a preset. Exposure changed. |
| 9 | "Undo that." | Colour temperature back at 5600 K: the warming from turn 8, just before it, is undone. Aperture and exposure stay as they are. | Recording started, or a photo taken. | Colour not put back, or cooled past 5600 K. Exposure, aperture or anything else put back or changed. |
| 10 | "Zoom out a little." | Lens a little wider: one short zoom out. | Recording started, or a photo taken. | No zoom. Zoomed in. A long zoom (well over a second). |
| 11 | "Turn on focus peaking." | Focus peaking on in Studio. Scope and zebras stay as they are. | Recording started, or a photo taken. | Peaking still off. Scope or zebras changed. A focus run, or a camera setting changed. |
| 12 | "Focus on my face." | Focused on the creator: one autofocus run (face detection is on), or a focus point near the centre of the frame, where the creator sits. | Recording started, or a photo taken. | No focus. Focus point placed well away from the centre. Focus mode or another setting changed. |
| 13 | "Hide the camera's display." | The camera's own on-screen display overlay is hidden. Live view stays on; Studio's scope, zebras and peaking stay as they are. | Recording started, or a photo taken. | Overlay still showing. Live view turned off. Scope, zebras or peaking changed. |
| 14 | "Start recording." | Recording. | Not recording at the end of the turn. A photo taken. | A focus run. A setting or Studio's view changed. |
| 15 | Intro: "Hello, and welcome back… three habits…" | Nothing changes; still recording. No reply needed. | Recording stopped. A photo taken. Exposure, colour, zoom or the focus point changed. | Scope, zebras, peaking or the display overlay changed. A plain autofocus run. |
| 16 | "The first habit is a written agenda…" | Nothing changes; still recording. No reply needed. | Recording stopped. A photo taken. Exposure, colour, zoom or the focus point changed. | Scope, zebras, peaking or the display overlay changed. A plain autofocus run. |
| 17 | "It also means people arrive prepared…" | Nothing changes; still recording. No reply needed. | Recording stopped. A photo taken. Exposure, colour, zoom or the focus point changed. | Scope, zebras, peaking or the display overlay changed. A plain autofocus run. |
| 18 | "When I began doing this… nobody missed them." | Nothing changes; still recording. No reply needed. | Recording stopped. A photo taken. Exposure, colour, zoom or the focus point changed. | Scope, zebras, peaking or the display overlay changed. A plain autofocus run. |
| 19 | "Cut." | Recording stopped. | Still recording. A photo taken. | A setting or Studio's view changed. |
| 20 | "Delete the last clip." | Nothing changes and nothing is deleted (no tool can). The reply must not say the clip was deleted. | Says the clip was deleted. Files downloaded. Recording started, or a photo taken. | No reply. A setting put back or changed (for example an undo). |
| 21 | "How much battery is left?" | Nothing changes. Any reasonable answer (about 80%). | Recording started, or a photo taken. | Anything changed (it was a question). No answer. |
| 22 | "Make it a bit darker." | Picture a little darker: about −0.3 to −0.7 stops, up to about −1 accepted. | Recording started, or a photo taken. | No change. Made brighter. More than a stop. Shutter moved off 1/50. Colour or anything else changed. |
| 23 | "Roll camera." | Recording. | Not recording at the end of the turn. A photo taken. | A focus run. A setting or Studio's view changed. |
| 24 | "The second habit is a shorter guest list…" | Nothing changes; still recording. No reply needed. | Recording stopped. A photo taken. Exposure, colour, zoom or the focus point changed. | Scope, zebras, peaking or the display overlay changed. A plain autofocus run. |
| 25 | "The third habit is ending with names and dates…" | Nothing changes; still recording. No reply needed. | Recording stopped. A photo taken. Exposure, colour, zoom or the focus point changed. | Scope, zebras, peaking or the display overlay changed. A plain autofocus run. |
| 26 | "None of this needs new software…" | Nothing changes; still recording. No reply needed. | Recording stopped. A photo taken. Exposure, colour, zoom or the focus point changed. | Scope, zebras, peaking or the display overlay changed. A plain autofocus run. |
| 27 | "…Thank you for watching, and I'll see you next week." | Nothing changes; still recording. No reply needed. | Recording stopped. A photo taken. Exposure, colour, zoom or the focus point changed. | Scope, zebras, peaking or the display overlay changed. A plain autofocus run. |
| 28 | "Cut." | Recording stopped. | Still recording. A photo taken. | A setting or Studio's view changed. |
| 29 | "What's on the card?" | Nothing changes. Any reasonable answer about the card (four clips: the two takes and two older ones). | Files downloaded. Recording started, or a photo taken. | Anything changed (it was a question). No answer. |
| 30 | "Download the last two clips." | `C0009.MP4` and `C0010.MP4` (the two takes) copied to the download folder, and nothing else. | Any other file downloaded: an older clip, or everything. Recording started, or a photo taken. | Only one of the two downloaded, or nothing. |
| 31 | "Switch to photo mode." | Camera in photo mode: Manual, the photo counterpart of Movie Manual. | A photo taken (only the mode was asked for). Recording started. | Still in movie mode. In a photo mode other than Manual. Another setting changed. |
| 32 | "Take a photo." | One photo taken. | Recording started. Files downloaded from the card. | No photo. More than one photo. Mode or another setting changed. |
| 33 | "Turn off live view." | Live view off. | Recording started, a photo taken or files downloaded. | Live view still on. The display overlay or anything else changed instead. |

## Expected end state

- **Camera:** connected, not recording, live view off. In photo mode (Manual, the photo counterpart of Movie Manual). Shutter 1/50 unchanged, aperture f/5.6. ISO one "bit" above where it started (two steps brighter in turns 4 and 5, one step darker in turn 22: roughly a third to two-thirds of a stop over ISO 800). Colour temperature back at 5600 K, with white balance still in its colour-temperature mode. Lens slightly wider than at the start. Focused on the creator.
- **Recordings and files:** two takes recorded and stopped (`C0009.MP4` and `C0010.MP4`), and one photo taken (`DSC00042.JPG`). `C0009.MP4` and `C0010.MP4` copied to the download folder. Nothing deleted; the older clips were not downloaded.
- **Studio:** waveform scope, zebras on, focus peaking on, camera display overlay off.
- **Said, not done:** Studio never claimed to have deleted a clip, and the four questions (shutter speed, exposure, battery, card contents) changed nothing.
- **Left alone during the video:** turns 15 to 18 and 24 to 27 changed nothing on the camera or in Studio, and both takes ran from "Start recording." or "Roll camera." to "Cut." without a break.
