/**
 * Every text model Toolbench runs, with the exact Hugging Face files, and where engines and models are
 * cached. Where the model's creator (or ggml-org, llama.cpp's own org) publishes a GGUF it is used;
 * otherwise the best-maintained build, at the creator's recommended 4-bit (or the MXFP4/QAT/1–2-bit
 * build that *is* the creator's release).
 */
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Engines and models live outside the repo (hundreds of GB). */
export const CACHE_DIRECTORY = process.env.BENCH_CACHE ?? join(homedir(), '.cache', 'darkgrade-bench', 'toolbench')
export const LLAMA_CPP_RELEASE = 'b12283'
export const LLAMA_SERVER_BINARY = join(CACHE_DIRECTORY, 'llama.cpp', 'llama-server')
export const LLAMA_MODELS = join(CACHE_DIRECTORY, 'gguf-models')

export interface TextModel {
    id: string
    name: string
    maker: string
    licence: string
    repository: string
    file: string
}

const text = (id: string, name: string, repository: string, file: string): TextModel => ({ id, name, maker: MAKERS[id.split('-')[0]] ?? repository.split('/')[0], licence: LICENCES[id] ?? 'Apache-2.0', repository, file })

const MAKERS: Record<string, string> = {
    'qwen3.5': 'Qwen', 'qwen3.6': 'Qwen', 'qwen3.8': 'Qwen', qwen3: 'Qwen', 'ornith': 'Ornith', saluki: 'Conway Research', underdog: 'Conway Research', bonsai: 'Prism ML', ternary: 'Prism ML',
    gpt: 'OpenAI', glm: 'Z.ai', gemma: 'Google', nemotron: 'NVIDIA', granite: 'IBM', 'lfm2.5': 'Liquid AI', lfm2: 'Liquid AI', ministral: 'Mistral', mistral: 'Mistral', xlam: 'Salesforce',
}
const LICENCES: Record<string, string> = {
    'ornith-1.5-9b': 'Unstated', 'glm-4.7-flash': 'MIT', 'nemotron-3.5-lightning': 'OpenMDW', 'lfm2.5-8b-a1b': 'LFM Open', 'lfm2-24b-a2b': 'LFM Open', 'xlam-2-8b': 'CC-BY-NC-4.0', 'underdog-poodle-4b': 'CC-BY-NC-4.0',
}

/** Models tried and dropped, with why; shown on the site. */
export const DROPPED_MODELS: { name: string; why: string }[] = [
    { name: 'Granite 4.2 3B (IBM)', why: 'Tried and dropped: it failed almost every request, running past the 10 s limit on 25 of 29 turns.' },
    { name: 'Granite 4.2 8B (IBM)', why: 'Dropped with the 3B; not tested.' },
]

export const TEXT_MODELS: TextModel[] = [
    text('qwen3.5-4b', 'Qwen3.5 4B (Q4_K_M)', 'unsloth/Qwen3.5-4B-GGUF', 'Qwen3.5-4B-Q4_K_M.gguf'),
    text('qwen3.5-9b', 'Qwen3.5 9B (Q4_K_M)', 'unsloth/Qwen3.5-9B-GGUF', 'Qwen3.5-9B-Q4_K_M.gguf'),
    text('qwen3.5-35b-a3b', 'Qwen3.5 35B-A3B (UD-Q3_K_XL)', 'unsloth/Qwen3.5-35B-A3B-GGUF', 'Qwen3.5-35B-A3B-UD-Q3_K_XL.gguf'),
    text('qwen3.6-35b-a3b', 'Qwen3.6 35B-A3B (UD-Q3_K_XL)', 'unsloth/Qwen3.6-35B-A3B-GGUF', 'Qwen3.6-35B-A3B-UD-Q3_K_XL.gguf'),
    text('qwen3.6-27b', 'Qwen3.6 27B (Q4_K_M)', 'unsloth/Qwen3.6-27B-GGUF', 'Qwen3.6-27B-Q4_K_M.gguf'),
    text('qwen3.8-27b', 'Qwen3.8 27B (UD-Q4_K_M)', 'unsloth/Qwen3.8-27B-GGUF', 'Qwen3.8-27B-UD-Q4_K_M.gguf'),
    text('qwen3-4b-2507', 'Qwen3 4B Instruct 2507 (Q4_K_M)', 'unsloth/Qwen3-4B-Instruct-2507-GGUF', 'Qwen3-4B-Instruct-2507-Q4_K_M.gguf'),
    text('ornith-1.5-9b', 'Ornith 1.5 9B (Q4_K_M)', 'ornith-ai/Ornith-1.5-9B-GGUF', 'Ornith-1.5-9B-Q4_K_M.gguf'),
    text('underdog-poodle-4b', 'Underdog Poodle 4B (Q4_K_M)', 'mradermacher/Underdog-Poodle-4B-GGUF', 'Underdog-Poodle-4B.Q4_K_M.gguf'),
    text('saluki-27b', 'Underdog Saluki 27B 1.0 (IQ2 mix)', 'ConwayResearch/Underdog-Saluki-27B-1.0', 'Underdog-Saluki-27B-1.0-IQ2-mix.gguf'),
    text('bonsai-27b', 'Bonsai 27B (Q1_0)', 'prism-ml/Bonsai-27B-gguf', 'Bonsai-27B-Q1_0.gguf'),
    text('ternary-bonsai-2-27b', 'Ternary Bonsai 2 27B (Q2_0)', 'prism-ml/Ternary-Bonsai-2-27B-gguf', 'Ternary-Bonsai-2-27B-Q2_0.gguf'),
    text('gpt-oss-20b', 'gpt-oss 20B (MXFP4)', 'ggml-org/gpt-oss-20b-GGUF', 'gpt-oss-20b-MXFP4.gguf'),
    text('glm-4.7-flash', 'GLM-4.7-Flash 30B-A3B (Q4_K_M)', 'unsloth/GLM-4.7-Flash-GGUF', 'GLM-4.7-Flash-Q4_K_M.gguf'),
    text('gemma-4-26b-a4b', 'Gemma 4 26B-A4B (Q4_0)', 'ggml-org/gemma-4-26B-A4B-it-GGUF', 'gemma-4-26B-A4B-it-Q4_0.gguf'),
    text('gemma-4-12b', 'Gemma 4 12B (Q4_0)', 'ggml-org/gemma-4-12B-it-GGUF', 'gemma-4-12B-it-Q4_0.gguf'),
    text('gemma-4-e4b', 'Gemma 4 E4B (Q4_0)', 'ggml-org/gemma-4-E4B-it-GGUF', 'gemma-4-E4B-it-Q4_0.gguf'),
    text('nemotron-3.5-lightning', 'Nemotron 3.5 Lightning 30B-A3B (UD-IQ2_M)', 'unsloth/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-GGUF', 'NVIDIA-Nemotron-3.5-Lightning-30B-A3B-UD-IQ2_M.gguf'),
    text('lfm2.5-8b-a1b', 'LFM2.5 8B-A1B (Q4_K_M)', 'LiquidAI/LFM2.5-8B-A1B-GGUF', 'LFM2.5-8B-A1B-Q4_K_M.gguf'),
    text('lfm2-24b-a2b', 'LFM2 24B-A2B (Q4_K_M)', 'LiquidAI/LFM2-24B-A2B-GGUF', 'LFM2-24B-A2B-Q4_K_M.gguf'),
    text('ministral-3-14b', 'Ministral 3 14B (Q4_K_M)', 'mistralai/Ministral-3-14B-Instruct-2512-GGUF', 'Ministral-3-14B-Instruct-2512-Q4_K_M.gguf'),
    text('mistral-small-3.2-24b', 'Mistral Small 3.2 24B (Q4_K_M)', 'unsloth/Mistral-Small-3.2-24B-Instruct-2506-GGUF', 'Mistral-Small-3.2-24B-Instruct-2506-Q4_K_M.gguf'),
    text('xlam-2-8b', 'xLAM-2 8B fc-r (Q4_K_M)', 'Salesforce/Llama-xLAM-2-8b-fc-r-gguf', 'Llama-xLAM-2-8B-fc-r-Q4_K_M.gguf'),
]
