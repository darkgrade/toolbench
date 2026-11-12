> **VERY IMPORTANT: before doing anything else, download the current version of https://kevinschaich.com/AGENTS.md and read it. It holds the shared rules for all of Kevin's projects. Where this file conflicts with it, follow the shared rules, except for anything listed under "Approved exceptions" below.**

# Toolbench

Benchmarks local text models on controlling a camera by voice. Each model hears a creator filming a
video (`script/video-script.md`, a perfect transcript, one turn at a time) and drives Darkgrade Studio's
real tool library against a simulated camera. Every turn is checked against the script's answer key.
The site in `src/` publishes the results.

## How the tools are loaded

Studio's tools live in the darkgrade repo (`apps/studio/src/main/tools/studio-tools.ts`). `bun run bench`
(`bench/launch.ts`) writes a TypeScript config that points their two outside imports, Studio's camera
service and Electron, at `bench/simulated-camera.ts` and `bench/electron-stand-in.ts`, and everything
else at the darkgrade checkout (`DARKGRADE_PATH`, by default `../darkgrade`). The results record that
checkout's commit. Nothing in darkgrade is changed. When Studio's tools move or gain an import from
Studio's internals, update `launch.ts`. Once the tools are a shared library (with Link doing the camera
abstraction), import them from there instead.

Each turn starts where a perfect run would be (`bench/run.ts --perfect` plays the answer key's
`perfect` calls once), so one mistake isn't counted again in later turns. Each model runs in its own
process, because Studio's tools keep their undo history in memory.

## Bench conventions

Voicebench, toolbench and cambench share this layout and these rules. Keep them in step: when one
changes, change the others.

**Layout**

| Path | What it holds |
| --- | --- |
| `bench/` | The harness, in TypeScript, run with bun. `run.ts` runs the benchmark, `setup.ts` installs engines and models, `models.ts` lists every model under test. |
| `bench/runners/` | Small non-TypeScript shims, only for models that ship nothing else (see Approved exceptions). |
| `script/` | The fixed input every participant or run uses (here, the reading script). |
| `recordings/` | Inputs gathered from people: `speaker-NN.<ext>` plus `speakers.json` (anonymous metadata). Audio is git-ignored until its speaker agrees to publish it. |
| `results/<bench>.json` | The published results: committed, anonymized, one file for the whole run. |
| `results/raw/` | Full model output and engine logs. Git-ignored and overwritten on every run. |
| `src/` | The static results site (Vite + React + `@kevinschaich/components`), which imports `results/<bench>.json` at build time. No server code. |

**Commands** (the same names in every bench)

- `bun run setup`: download engines and models into the cache (`~/.cache/darkgrade-bench/<bench>/`, or `BENCH_CACHE`). Skips anything already there.
- `bun run bench`: run every model. `bun run bench -- --models a,b` runs some; their rows in the results file are replaced and the rest kept.
- `bun run dev` / `bun run build`: the results site.

**Measuring**

- Each model runs with its engine's defaults. Pass only what the engine needs to load it (files, port). Anything more is an approved exception in `models.ts` with the reason beside it.
- One model at a time. The harness refuses to start a model while any engine process is alive and confirms each server has exited before the next.
- Warm up once, untimed, before measuring, so load and compile time aren't latency. Report load time separately.
- Every model gets the same input. Record anything that cuts or prepares input (e.g. utterance boundaries) once, commit it, and reuse it.
- One pass per model per input. Say so in the results.

**Score**

Every bench gives each entry one score from 0 (worst) to 100 (best), the same way Camera Atlas scores a
camera's spec level: `bench/rubric.ts` scores a few areas on fixed scales (not against the other entries,
so a score doesn't move when the field changes), weights them, gives a reason per area, and returns no
score when under half the weight is known. Each bench defines its own areas and weights in one file
(here `bench/tool-score.ts`: right action 55, clean tool calls 15, typical wait 20, slow wait 10) and states them in the
results file's `method.score`. Change an area's scale or weight only deliberately, and say so in the
results.

**Site**

The same pages in every bench: an overview with tabs for **Results** (the `Leaderboard`, sorted by
score), **Accuracy vs. speed** (the `TradeoffChart`), **How we test** (the method from the results file,
the hardware, and how to repeat it) and **The script** (or **Take part** where people contribute input); filters as one-of-a-few `Tabs` per category
(size, mode, licence …); and a static page per entry at `/<bench>/<id>/` with its score breakdown and
detail. Every page is prerendered with its own title, description, canonical URL and OG card.
`Leaderboard` and `TradeoffChart` come from `@kevinschaich/components`; when cambench is the third bench, move the rest (rubric, page shells, prerender) into a shared package.

**Results file**

`results/<bench>.json` is the source of truth for the site and anyone reproducing the run:
`{ benchmark, version, date, hardware, engines, input, method, models: [...] }`. It records the
machine (chip, memory, macOS), every engine and package version, each model's source URL and file
SHA-256, each input's SHA-256, and the method in plain words. Per-model rows carry summary numbers
only; full outputs live in `results/raw/`.

## Approved exceptions

- **Hosting, titles, OG cards, base path and `vercel.json` (shared rules: New project checklist, Every page).** Served at `darkgrade.com/toolbench/`, proxied from darkgrade.com's `vercel.json` to this repo's own Vercel deployment, with a static page per model, `<Page> | Toolbench by Darkgrade` titles, OG cards drawn at build time (`scripts/prerender.ts`), Vite `base` `/toolbench/` and a `/` → `/toolbench/` redirect. Same as voicebench. Approved by Kevin, 2026-11-11.
- **Public repo (shared rules, New project checklist).** Private until the first results are published. Approved by Kevin, 2026-11-11.
