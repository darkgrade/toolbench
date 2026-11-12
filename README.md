[![Toolbench by kevinschaich](https://kevinschaich.com/og/toolbench.png)](https://kevinschaich.com/project/toolbench/)

# Toolbench

Which local AI model gets your camera commands right?

**[Try it →](https://darkgrade.com/toolbench/)**

## How it works

Each model hears the same script, word for word: a creator filming a two-take video with requests to
Darkgrade Studio, their camera app, in between and during the takes (`script/video-script.md`). The
model has Studio's real tools and acts on a simulated camera. Every one of the 33 turns is checked
against the script's answer key by outcome: did the camera and Studio end up where you'd want them? Lookups
and the wording of answers don't count. Mistakes that would ruin a take or your work (recording at the
wrong time, an unasked photo or download, the picture changed mid-take) are serious; small slips are minor.
English only for now.

- Every model runs locally with llama.cpp's `llama-server` and its default settings, one at a time, except
  that thinking is off for every model (`--reasoning off`): a voice app has to act at once.
- Each turn starts from where a perfect run would be, so one mistake isn't counted twice.
- The 0–100 score weighs the right outcome most (45%: a turn counts 1 when right, ½ with only minor
  mistakes, 0 with a serious one), then serious mistakes (15%), clean tool calls (5%) and how long it
  takes to decide (35%), on fixed scales. Each model gets 10 s to decide; the reply after acting isn't timed.

`results/toolbench.json` has every number, plus the hardware, the llama.cpp version, each model's file
checksum and the darkgrade commit whose tools were tested.

## Run locally

```sh
bun install
bun run bench    # needs a darkgrade checkout next to this one, or DARKGRADE_PATH
bun run dev      # the results site
```

Needs Apple Silicon, macOS, Node 24, bun, ffmpeg and the models in `~/.cache/darkgrade-bench/toolbench`.
