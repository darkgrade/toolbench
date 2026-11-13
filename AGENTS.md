> **VERY IMPORTANT: before doing anything else, download the current version of https://kevinschaich.com/AGENTS.md and read it. It holds the shared rules for all of Kevin's projects. Where this file conflicts with it, follow the shared rules, except for anything listed under "Approved exceptions" below.**

# Toolbench

Benchmarks local text models on controlling a camera by voice. Each model hears a creator filming a
video (`script/video-script.md`, a perfect transcript, one turn at a time) and drives Darkgrade Studio's
real tool library against a simulated camera. Every turn is checked against the script's answer key.
The site in `src/` publishes the results.

## How the tools are loaded

Studio's tools live in the darkgrade repo (`apps/studio/src/main/tools/studio-tools.ts`). `bench/studio-config.ts`
writes a TypeScript config that points their two outside imports, Studio's camera
service and Electron, at `bench/simulated-camera.ts` and `bench/electron-stand-in.ts`, and everything
else at the darkgrade checkout (`DARKGRADE_PATH`, by default `../darkgrade`). The results record that
checkout's commit. Nothing in darkgrade is changed. When Studio's tools move or gain an import from
Studio's internals, update `studio-config.ts`. Once the tools are a shared library (with Link doing the camera
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
| `bench/` | The harness, in TypeScript, run with bun. `workflow.ts` is the benchmark as a workflow (Outpost's workflows: one task per model, smaller tasks under it, then `publish`), `run.ts` measures, `setup.ts` installs engines and models, `models.ts` lists every model under test. |
| `.claude-plugin/`, `outpost/` | The Outpost app: installed from this repository, it shows the workflow's runs live (Run, Run without cache, Cancel, Retry), and keeps a worker on the Mac running this repository's latest commit. It doesn't show the results: the site does. Never part of the public site. |
| `bench/runners/` | Small non-TypeScript shims, only for models that ship nothing else (see Approved exceptions). |
| `script/` | The fixed input every participant or run uses (here, the reading script). |
| `recordings/` | Inputs gathered from people: `speaker-NN.<ext>` plus `speakers.json` (anonymous metadata). Audio is git-ignored until its speaker agrees to publish it. |
| `results/<bench>.json` | The published results: committed, anonymized, one file for the whole run. |
| `results/raw/` | Full model output and engine logs. Git-ignored and overwritten on every run. |
| `src/` | The static results site (Vite + React + `@kevinschaich/components`), built from `results/` (see Site). No server code. |

**Commands** (the same names in every bench)

- `bun run setup`: download engines and models into the cache (`~/.cache/darkgrade-bench/<bench>/`, or `BENCH_CACHE`). Skips anything already there.
- `bun run worker`: serve the workflow's tasks on this Mac. In Outpost, `ops/worker.sh <bench>` keeps it running from Outpost's checkout; on its own it starts a development engine (nothing is published).
- `bun run bench`: start a run on the worker (every model; `-- --models a,b` for some, whose rows are replaced and the rest kept; `--force` redoes what earlier runs kept). In Outpost, start runs from the app instead: a run there ends by committing the results files to `main` through Outpost (`publish`), and Vercel deploys them.
- Results a task produced are kept (`results/raw/cache/`, git-ignored) under a key of everything that affects them (model files, input hashes, settings, harness code), so a run redoes only what changed.
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
(here `bench/tool-score.ts`: right outcome 45, serious mistakes 15, clean tool calls 5, typical wait 25, slow wait 10) and states them in the
results file's `method.score`. Change an area's scale or weight only deliberately, and say so in the
results.

**Site**

Every bench's overview is a full-window set of views over the same published results, each view at its own
path so it can be linked and prerendered. The first is always the **Story**: every measurement as a point of
light (`src/kit/points.ts`, WebGL) that rearranges as captions scroll past (`src/kit/story.tsx`), ending in
the ranking with a link to every entry's page. Here the points are one model on one turn, and the other
views are **Watch** (the shoot replayed turn by turn on a drawn viewfinder, each model waiting as long as it
really took), **Turns** (every model against every turn, and the different things models did with a turn),
**Field** (accuracy against wait, download or memory; its path is still `tradeoff/`), **Compare** (two
models side by side), **Table** (the `Leaderboard` with filters as one-of-a-few `Tabs`) and **Method**
(how we test, the hardware, how to repeat it, and the script; `script/` still opens it).

- `src/kit/` (points, story, shell, theme) is the same in all three benches: change one, change the others.
  Move it, with the rubric and prerender, into a shared package when that is worth a release.
- `scripts/build-data.ts` runs before `vite` and `vite build`. It writes `public/data/shoot.json` (every
  model's every turn, which the views fetch) and `src/facts.json` (the tallies the story's captions quote,
  bundled so they are prerendered). Neither is committed. Every number in a caption comes from there.
- `results/perfect.json` is where the camera and Studio's view are before each turn, from the perfect run
  (the workflow's `perfect` task rewrites it from the recorded run and `publish` commits it; that code is in
  `bench/workflow.ts`, which the cache key leaves out, so it never forces models to run again). Watch starts each turn
  from it and applies the model's calls (`src/views/watch/look.ts`): absolute settings as set, relative ones
  (brighter, warmer, zoom) as the change asked for.
- A static page per entry at `/<bench>/<id>/` (`src/entry.tsx`, `src/pages/model.tsx`), in the same frame as
  the overview: its score, its whole shoot turn by turn on the viewfinder, where it stands in the field and
  every turn written out, all in the prerendered page. It loads only its own detail file
  (`src/details.ts`), separately from the overview's code. These are the pages search engines have indexed:
  never change their address, title, description or canonical URL, and keep their substance in the HTML.
- Every page is prerendered with its own title, description, canonical URL and OG card.

**Results file**

`results/<bench>.json` is the source of truth for the site and anyone reproducing the run:
`{ benchmark, version, date, hardware, engines, input, method, models: [...] }`. It records the
machine (chip, memory, macOS), every engine and package version, each model's source URL and file
SHA-256, each input's SHA-256, and the method in plain words. Per-model rows carry summary numbers
only; full outputs live in `results/raw/`.

## Approved exceptions

- **Hosting, titles, OG cards, base path and `vercel.json` (shared rules: New project checklist, Every page).** Served at `darkgrade.com/toolbench/`, proxied from darkgrade.com's `vercel.json` to this repo's own Vercel deployment, with a static page per model, `<Page> | Toolbench by Darkgrade` titles, OG cards drawn at build time (`scripts/prerender.ts`), Vite `base` `/toolbench/` and a `/` → `/toolbench/` redirect. Same as voicebench. Approved by Kevin, 2026-11-11.
- **Public repo (shared rules, New project checklist).** Private until the first results are published. Approved by Kevin, 2026-11-11.
