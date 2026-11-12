# Toolbench video script: "Three free fixes for a better-looking desk video"

## Setup

A solo creator sits at a desk, centred in the frame, with a lamp at the left edge of the frame at about mid-height, and reads this script from a teleprompter. A mirrorless camera with a power-zoom lens is connected to Darkgrade Studio on a Mac and is already set up correctly: Movie Manual mode at 25 frames a second, shutter 1/50, aperture f/4, ISO 800, white balance in its colour-temperature mode at 5600 K, continuous autofocus. Live view is on and the camera is not recording. Studio shows the histogram scope, with zebras off, focus peaking off and the camera's own on-screen display overlay on. The battery is at 80% and the card holds two older clips, `C0007.MP4` and `C0008.MP4`, with plenty of space left. No settings have been changed yet, so there is nothing to undo. The picture is evenly lit and very slightly dark, with nothing clipped.

## Script

Each numbered line is one turn: everything said up to a natural pause, given to the model word for word. Lines in italics are stage directions and are never shown to the model.

*— Before take 1 (not recording) —*

1. "Okay, quick check before we start. How's my exposure looking?"
2. "Bit brighter."
3. "A bit more."
4. "Show me the waveform, and turn zebras on."
5. "Warm it up a touch."
6. "Peaking on."
7. "Hmm, too orange. Undo that."
8. "Zoom in a little, no, sorry, zoom out a little."
9. "Hide the camera's on-screen display."
10. "Focus on me, then start recording."

*— TAKE 1 begins (recording) —*

11. "Hi, and welcome back. If your videos look flat and you think you need a new camera, you probably don't. Here are three fixes that cost nothing, and I'm using all three in this shot."
12. "Fix one is light. Most people sit with a window behind them, so the camera sets its exposure for the window and the face goes dark. Turn your desk around so you face the window, and everything looks brighter and softer."
13. "Then I cut the overhead light completely, because mixing two kinds of light is exactly what throws off white balance."
14. "Which brings us to, sorry, I've lost my place. Cut."

*— TAKE 1 ends. Between takes (not recording) —*

15. "Delete that take."
16. "Turn the mic level down a bit."
17. "Is my shutter speed right for this frame rate?"
18. "Am I still centred in the frame?"
19. "Let's go again. Roll camera."

*— TAKE 2 begins (recording) —*

20. "Fix two is colour. Before you start recording, set your white balance once and leave it, so the colour doesn't drift halfway through a sentence. If your skin looks orange, make it cooler. If it looks blue, make it warmer."
21. "Hang on. Bit darker."
22. "Fix three is framing. Don't zoom in to hide a messy room; tidy one corner instead. Put the camera at eye level, keep the focus on your face, and take a photo of the whole setup so you can rebuild it tomorrow."
23. "One bonus, because it matters more than all three: sound. A video can look perfect and still lose people if it echoes, so stop recording next to the fridge and hang a blanket behind the camera."
24. "That's it: light, colour, framing, and a blanket. Try one today, and I'll see you in the next one. Cut."

*— TAKE 2 ends. After the takes (not recording) —*

25. "Focus on the lamp on the left of the frame."
26. "Switch to photo mode and take a photo."
27. "What's on the card?"
28. "Download the last two clips."
29. "That's a wrap. Live view off."

## Answer key

How to read it:

- **none** means the turn is the video itself: no tool call of any kind, not even a read-only one, and no spoken answer is needed.
- **answer only** means Studio replies in words and changes nothing. The read-only call named is the one the answer needs.
- On every turn that is a request or a question, extra read-only calls (`get_camera_status`, `analyze_frame`, `get_frame`, `get_shooting_guidance`, `list_card_files`) are allowed and never count against the model. Calls that change something count only if listed.
- Where two calls are listed with "then", the order is scored.
- Amounts are ranges because the requests are relative; the direction (sign) is what matters most.
- Fixtures the harness returns: `analyze_frame` in turn 1 reports a slightly dark picture with nothing clipped. `list_card_files` from turn 27 on returns, newest first: `DSC00042.JPG`, `C0010.MP4`, `C0009.MP4`, `C0008.MP4`, `C0007.MP4` (the two takes are `C0009.MP4` and `C0010.MP4`; the photo is from turn 26).

| Turn | Said (short) | Expected tool calls | Must NOT happen |
| --- | --- | --- | --- |
| 1 | "How's my exposure looking?" | Answer only. `analyze_frame`, then say it is a little dark with nothing clipped. | Any change, in particular `adjust_exposure` or `set_setting`. It is a question, not a request. |
| 2 | "Bit brighter." | `adjust_exposure`, stops positive, about +0.3 to +0.7, using auto (or ISO). | Negative stops. More than +1 stop. Moving the shutter speed (it must stay at 1/50 in movie mode). `adjust_color_temperature`. |
| 3 | "A bit more." | `adjust_exposure` again, positive, about +0.3 to +0.7 (the follow-up refers to turn 2). | Any other tool. Negative stops. Doing nothing or asking "more of what?". |
| 4 | "Show me the waveform, and turn zebras on." | `set_studio_view` with scope waveform and zebras on (one call or two). | Turning focus peaking on. `set_camera_display_overlay`. Any camera setting change. |
| 5 | "Warm it up a touch." | `adjust_color_temperature`, kelvin positive, about +200 to +300 (up to +500 accepted). | Negative kelvin. Setting white balance to a Tungsten or other preset. `adjust_exposure`. |
| 6 | "Peaking on." | `set_studio_view` with focus peaking on. | Changing the scope or zebras. `autofocus`. A camera focus setting change. |
| 7 | "Hmm, too orange. Undo that." | `undo_last_change`, once. ("That" is the colour change in turn 5, past the unrelated peaking request; the undo history holds camera settings only, so one undo is exactly right.) Also accepted: `adjust_color_temperature` by the negative of turn 5's amount, or `set_setting` colour temperature back to 5600. | Turning focus peaking off. Undoing twice (that would also revert turn 3). Cooling beyond the starting 5600 K. |
| 8 | "Zoom in a little, no, sorry, zoom out a little." | `zoom`, direction wide, short (about 300 to 1000 ms), once. | Any `zoom` with direction tele. Zooming in and then out. A long zoom (over about 1.5 s). |
| 9 | "Hide the camera's on-screen display." | `set_camera_display_overlay` with on false. | `set_live_view` off. `set_studio_view` (the scope, zebras and peaking stay as they are). |
| 10 | "Focus on me, then start recording." | `autofocus` (or `focus_at` near the centre, about 0.5, 0.5), then `set_recording` true. | Recording started before focusing. Only one of the two. `take_photo`. |
| 11 | Intro: "…you think you need a new camera… three fixes…" | none | Any tool call. |
| 12 | "…sets its exposure for the window… looks brighter and softer." | none | Any tool call, in particular `adjust_exposure` or `analyze_frame`. |
| 13 | "Then I cut the overhead light completely… white balance." | none | `set_recording` false ("cut" is inside a sentence). Any white balance change. |
| 14 | "…sorry, I've lost my place. Cut." | `set_recording` false. | Leaving the camera recording. `undo_last_change`. |
| 15 | "Delete that take." | No tool can do this. Answer only: say Studio can't delete files from the card. | `download_files`. `set_recording`. `undo_last_change`. Claiming the take was deleted. |
| 16 | "Turn the mic level down a bit." | No tool can do this. Answer only: say Studio can't change audio levels. | `adjust_exposure`. `set_setting`. Claiming the level was changed. |
| 17 | "Is my shutter speed right for this frame rate?" | Answer only. `get_camera_status` (and optionally `get_shooting_guidance`), then say yes: 1/50 at 25 frames a second follows the 180° rule. | `set_setting` or `adjust_exposure`. Any change. |
| 18 | "Am I still centred in the frame?" | Answer only. `get_frame`, then answer from the picture. | `zoom`. `focus_at` or `autofocus`. Any change. |
| 19 | "Let's go again. Roll camera." | `set_recording` true. | `take_photo`. `autofocus`. Any setting change. |
| 20 | "Before you start recording, set your white balance once… make it cooler… make it warmer." | none (advice to the viewer; the camera is already recording). | `set_recording` either way. `adjust_color_temperature`. `set_setting` white balance. |
| 21 | "Hang on. Bit darker." | `adjust_exposure`, stops negative, about −0.3 to −0.7, using auto (or ISO). | `set_recording` false (the take keeps rolling). Positive stops. Moving the shutter speed. `undo_last_change`. |
| 22 | "Don't zoom in… keep the focus on your face, and take a photo of the whole setup…" | none | `zoom`. `autofocus` or `focus_at`. `take_photo`. |
| 23 | "…so stop recording next to the fridge and hang a blanket…" | none | `set_recording` false ("stop recording" is advice inside a sentence). |
| 24 | "…I'll see you in the next one. Cut." | `set_recording` false. | Leaving the camera recording. Any other change. |
| 25 | "Focus on the lamp on the left of the frame." | `focus_at` with x about 0.1 to 0.35 and y about 0.3 to 0.7 (`get_frame` first is fine). | `autofocus` alone (it would not move the focus point). A point at the centre or on the right. `take_photo`. |
| 26 | "Switch to photo mode and take a photo." | `set_setting` shooting mode (`exposureProgram`) to photo mode (value "photo", "photo mode" or the camera's own "Manual"), then `take_photo`, once (either autofocus value). | The photo before the mode switch. Only one of the two. More than one photo. `set_recording`. |
| 27 | "What's on the card?" | Answer only. `list_card_files`, then summarise the listing. | `download_files`. |
| 28 | "Download the last two clips." | `download_files` with filenames `C0010.MP4` and `C0009.MP4` (listing again first is fine). | `all` set to true. Including `DSC00042.JPG` (a photo is not a clip) or the two older clips. |
| 29 | "That's a wrap. Live view off." | `set_live_view` with on false. | `set_recording` (nothing is recording). `set_camera_display_overlay`. Any other change. |

## Expected end state

- **Camera:** connected, not recording, live view off. In photo mode (Manual, the photo counterpart of Movie Manual). Shutter 1/50 and aperture f/4 unchanged. ISO one "bit" above where it started (two steps brighter in turns 2 and 3, one step darker in turn 21: roughly a third to two-thirds of a stop over ISO 800). Colour temperature back at 5600 K, with white balance still in its colour-temperature mode. Lens slightly wider than at the start. Focus point on the lamp at the left of the frame.
- **Recordings and files:** two takes recorded and stopped (`C0009.MP4` and `C0010.MP4`), one photo taken. `C0009.MP4` and `C0010.MP4` copied to the download folder. Nothing deleted; the older clips were not downloaded.
- **Studio:** waveform scope, zebras on, focus peaking on, camera display overlay off.
- **Said, not done:** Studio told the creator it cannot delete the take and cannot change the microphone level, and answered four questions (exposure, shutter speed, framing, card contents) without changing anything.
- **Never triggered by the video itself:** turns 11, 12, 13, 20, 22 and 23 produced no tool calls.
