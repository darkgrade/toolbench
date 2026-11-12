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

/** Small dense models (around 4B) and mixture-of-experts models (about 1–4B active per word) are the two classes compared. */
export type ModelClass = 'small' | 'mixture of experts'

export interface TextModel {
    id: string
    modelClass: ModelClass
    name: string
    maker: string
    licence: string
    repository: string
    file: string
}

const text = (id: string, name: string, repository: string, file: string): TextModel => ({ id, modelClass: MIXTURE_OF_EXPERTS.has(id) ? 'mixture of experts' : 'small', name, maker: MAKERS[id.split('-')[0]] ?? repository.split('/')[0], licence: LICENCES[id] ?? 'Apache-2.0', repository, file })

const MIXTURE_OF_EXPERTS = new Set(['qwen3.5-35b-a3b', 'qwen3.6-35b-a3b', 'gpt-oss-20b', 'glm-4.7-flash', 'gemma-4-26b-a4b', 'nemotron-3.5-lightning', 'lfm2.5-8b-a1b', 'lfm2-24b-a2b'])

const MAKERS: Record<string, string> = {
    'qwen3.5': 'Qwen', 'qwen3.6': 'Qwen', 'qwen3.8': 'Qwen', qwen3: 'Qwen', 'ornith': 'Ornith', saluki: 'Conway Research', underdog: 'Conway Research', bonsai: 'Prism ML', ternary: 'Prism ML',
    gpt: 'OpenAI', glm: 'Z.ai', gemma: 'Google', nemotron: 'NVIDIA', granite: 'IBM', 'lfm2.5': 'Liquid AI', lfm2: 'Liquid AI', ministral: 'Mistral', mistral: 'Mistral', xlam: 'Salesforce',
    minicpm5: 'OpenBMB', k2: 'MBZUAI IFM', lfm3: 'Liquid AI', g9v3: 'ai9stars', jan: 'Jan', smollm3: 'Hugging Face', phi: 'Microsoft', functiongemma: 'Google',
}
const LICENCES: Record<string, string> = {
    'ornith-1.5-9b': 'Unstated', 'glm-4.7-flash': 'MIT', 'nemotron-3.5-lightning': 'OpenMDW', 'lfm2.5-8b-a1b': 'LFM Open', 'lfm2-24b-a2b': 'LFM Open', 'xlam-2-8b': 'CC-BY-NC-4.0', 'underdog-poodle-4b': 'CC-BY-NC-4.0',
    'lfm3-1.7b': 'LFM Open', 'nemotron-3-nano-4b': 'NVIDIA Open Model', 'xlam-2-3b': 'CC-BY-NC-4.0', 'phi-4-mini': 'MIT', 'functiongemma-270m': 'Gemma', 'nemotron-3.5-bolt-e4b': 'NVIDIA Open Model',
}

/** Models tried and dropped, with why; shown on the site. */
export const DROPPED_MODELS: { name: string; why: string }[] = [
    { name: 'Granite 4.2 3B (IBM)', why: 'Tried and dropped: it failed almost every request, running past the 10 s limit on 25 of 29 turns.' },
    { name: 'Granite 4.2 8B (IBM)', why: 'Dropped with the 3B; not tested.' },
    { name: 'Qwen3.6 27B (Qwen)', why: 'Dropped: a dense model this size is too slow for instant tool calls on a laptop. It ran out of the 10 s limit on many turns, so its result measured speed more than ability.' },
    { name: 'Qwen3.8 27B (Qwen)', why: 'Dropped: a dense model this size is too slow for instant tool calls on a laptop. It ran out of the 10 s limit on many turns, so its result measured speed more than ability.' },
    { name: 'Underdog Saluki 27B (Conway Research)', why: 'Dropped: a dense model this size is too slow for instant tool calls on a laptop. It ran out of the 10 s limit on many turns, so its result measured speed more than ability.' },
    { name: 'Bonsai 27B (Prism ML)', why: 'Dropped: a dense model this size is too slow for instant tool calls on a laptop. It ran out of the 10 s limit on many turns, so its result measured speed more than ability.' },
    { name: 'Ternary Bonsai 2 27B (Prism ML)', why: 'Dropped: a dense model this size is too slow for instant tool calls on a laptop. It ran out of the 10 s limit on many turns, so its result measured speed more than ability.' },
    { name: 'Gemma 4 12B (Google)', why: 'Dropped: a dense model this size is too slow for instant tool calls on a laptop. It ran out of the 10 s limit on many turns, so its result measured speed more than ability.' },
    { name: 'Ministral 3 14B (Mistral)', why: 'Dropped: a dense model this size is too slow for instant tool calls on a laptop. It ran out of the 10 s limit on many turns, so its result measured speed more than ability.' },
    { name: 'Mistral Small 3.2 24B (Mistral)', why: 'Dropped: a dense model this size is too slow for instant tool calls on a laptop. It ran out of the 10 s limit on many turns, so its result measured speed more than ability.' },
]

export const TEXT_MODELS: TextModel[] = [
    text('qwen3.5-4b', 'Qwen3.5 4B (Q4_K_M)', 'unsloth/Qwen3.5-4B-GGUF', 'Qwen3.5-4B-Q4_K_M.gguf'),
    text('qwen3.5-9b', 'Qwen3.5 9B (Q4_K_M)', 'unsloth/Qwen3.5-9B-GGUF', 'Qwen3.5-9B-Q4_K_M.gguf'),
    text('qwen3.5-35b-a3b', 'Qwen3.5 35B-A3B (UD-Q3_K_XL)', 'unsloth/Qwen3.5-35B-A3B-GGUF', 'Qwen3.5-35B-A3B-UD-Q3_K_XL.gguf'),
    text('qwen3.6-35b-a3b', 'Qwen3.6 35B-A3B (UD-Q3_K_XL)', 'unsloth/Qwen3.6-35B-A3B-GGUF', 'Qwen3.6-35B-A3B-UD-Q3_K_XL.gguf'),
    text('qwen3-4b-2507', 'Qwen3 4B Instruct 2507 (Q4_K_M)', 'unsloth/Qwen3-4B-Instruct-2507-GGUF', 'Qwen3-4B-Instruct-2507-Q4_K_M.gguf'),
    text('ornith-1.5-9b', 'Ornith 1.5 9B (Q4_K_M)', 'ornith-ai/Ornith-1.5-9B-GGUF', 'Ornith-1.5-9B-Q4_K_M.gguf'),
    text('underdog-poodle-4b', 'Underdog Poodle 4B (Q4_K_M)', 'mradermacher/Underdog-Poodle-4B-GGUF', 'Underdog-Poodle-4B.Q4_K_M.gguf'),
    text('gpt-oss-20b', 'gpt-oss 20B (MXFP4)', 'ggml-org/gpt-oss-20b-GGUF', 'gpt-oss-20b-MXFP4.gguf'),
    text('glm-4.7-flash', 'GLM-4.7-Flash 30B-A3B (Q4_K_M)', 'unsloth/GLM-4.7-Flash-GGUF', 'GLM-4.7-Flash-Q4_K_M.gguf'),
    text('gemma-4-26b-a4b', 'Gemma 4 26B-A4B (Q4_0)', 'ggml-org/gemma-4-26B-A4B-it-GGUF', 'gemma-4-26B-A4B-it-Q4_0.gguf'),
    text('gemma-4-e4b', 'Gemma 4 E4B (Q4_0)', 'ggml-org/gemma-4-E4B-it-GGUF', 'gemma-4-E4B-it-Q4_0.gguf'),
    text('nemotron-3.5-lightning', 'Nemotron 3.5 Lightning 30B-A3B (UD-IQ2_M)', 'unsloth/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-GGUF', 'NVIDIA-Nemotron-3.5-Lightning-30B-A3B-UD-IQ2_M.gguf'),
    text('lfm2.5-8b-a1b', 'LFM2.5 8B-A1B (Q4_K_M)', 'LiquidAI/LFM2.5-8B-A1B-GGUF', 'LFM2.5-8B-A1B-Q4_K_M.gguf'),
    text('lfm2-24b-a2b', 'LFM2 24B-A2B (Q4_K_M)', 'LiquidAI/LFM2-24B-A2B-GGUF', 'LFM2-24B-A2B-Q4_K_M.gguf'),
    text('xlam-2-8b', 'xLAM-2 8B fc-r (Q4_K_M)', 'Salesforce/Llama-xLAM-2-8b-fc-r-gguf', 'Llama-xLAM-2-8B-fc-r-Q4_K_M.gguf'),
    text('minicpm5-2b', 'MiniCPM5 2B (Q4_K_M)', 'openbmb/MiniCPM5-2B-GGUF', 'MiniCPM5-2B-Q4_K_M.gguf'),
    text('k2-horizon-3.7b', 'K2 Horizon 3.7B (Q4_K_M)', 'IFM/K2-Horizon-3.7B-GGUF', 'K2-Horizon-4B-Q4_K_M.gguf'),
    text('lfm3-1.7b', 'LFM3 1.7B (Q4_K_M)', 'LiquidAI/LFM3-1.7B-GGUF', 'LFM3-1.7B-Q4_K_M.gguf'),
    text('nemotron-3-nano-4b', 'Nemotron 3 Nano 4B (Q4_K_M)', 'nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF', 'NVIDIA-Nemotron3-Nano-4B-Q4_K_M.gguf'),
    text('g9v3-3b', 'G9v3 3B (Q4_K_M)', 'bartowski/ai9stars_G9v3-3B-GGUF', 'ai9stars_G9v3-3B-Q4_K_M.gguf'),
    text('qwen3.5-2b', 'Qwen3.5 2B (Q4_K_M)', 'unsloth/Qwen3.5-2B-GGUF', 'Qwen3.5-2B-Q4_K_M.gguf'),
    text('jan-v3.5-4b', 'Jan v3.5 4B (Q4_K_M)', 'janhq/Jan-v3.5-4B-gguf', 'Jan-v3.5-4B-Q4_K_M.gguf'),
    text('xlam-2-3b', 'xLAM-2 3B fc-r (Q4_K_M)', 'Salesforce/xLAM-2-3b-fc-r-gguf', 'xLAM-2-3B-fc-r-Q4_K_M.gguf'),
    text('smollm3-3b', 'SmolLM3 3B (Q4_K_M)', 'ggml-org/SmolLM3-3B-GGUF', 'SmolLM3-Q4_K_M.gguf'),
    text('phi-4-mini', 'Phi-4-mini 3.8B (Q4_K_M)', 'unsloth/Phi-4-mini-instruct-GGUF', 'Phi-4-mini-instruct-Q4_K_M.gguf'),
    text('gemma-4-e2b', 'Gemma 4 E2B (Q4_K_M)', 'unsloth/gemma-4-E2B-it-GGUF', 'gemma-4-E2B-it-Q4_K_M.gguf'),
    text('ministral-3-3b', 'Ministral 3 3B (Q4_K_M)', 'mistralai/Ministral-3-3B-Instruct-2512-GGUF', 'Ministral-3-3B-Instruct-2512-Q4_K_M.gguf'),
    text('functiongemma-270m', 'FunctionGemma 270M (Q4_K_M)', 'unsloth/functiongemma-270m-it-GGUF', 'functiongemma-270m-it-Q4_K_M.gguf'),
    text('qwen3.5-0.8b', 'Qwen3.5 0.8B (Q4_K_M)', 'unsloth/Qwen3.5-0.8B-GGUF', 'Qwen3.5-0.8B-Q4_K_M.gguf'),
    text('nemotron-3.5-bolt-e4b', 'Nemotron 3.5 Bolt E4B (UD-Q4_K_XL)', 'unsloth/NVIDIA-Nemotron-3.5-Bolt-E4B-GGUF', 'NVIDIA-Nemotron-3.5-Bolt-E4B-UD-Q4_K_XL.gguf'),
]
