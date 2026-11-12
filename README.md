[![Toolbench by kevinschaich](https://kevinschaich.com/og/toolbench.png)](https://kevinschaich.com/project/toolbench/)

# Toolbench

Which local AI model gets your camera commands right?

**[Try it →](https://darkgrade.com/toolbench/)**

## How it works

Each model hears the same script, word for word: a creator filming a two-take video with requests to
Darkgrade Studio, their camera app, in between and during the takes (`script/video-script.md`). The
model has Studio's real tools and acts on a simulated camera. Every one of the 29 turns is checked
against the script's answer key: did it do the right thing, in the right order, leave the video itself
alone, answer questions without acting, and say what it can't do? English only for now.

- Every model runs locally with llama.cpp's `llama-server` and its default settings, one at a time.
- Each turn starts from where a perfect run would be, so one mistake isn't counted twice.
- The 0–100 score weighs the right action most (55%), then clean tool calls (15%) and how long it takes
  to act (30%), on fixed scales.

`results/toolbench.json` has every number, plus the hardware, the llama.cpp version, each model's file
checksum and the darkgrade commit whose tools were tested.

## Run locally

```sh
bun install
bun run bench    # needs a darkgrade checkout next to this one, or DARKGRADE_PATH
bun run dev      # the results site
```

Needs Apple Silicon, macOS, Node 24, bun, ffmpeg and the models in `~/.cache/darkgrade-bench/toolbench`.
