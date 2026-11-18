/**
 * One step of a cloud model (models.ts CLOUD_MODELS): the conversation so far and Studio's tools in, its reply and
 * tool calls out, in the same shape a local model's streamed reply is read into. It goes through Outpost's model
 * gateway with the worker's own Outpost token (OUTPOST_MCP_URL, OUTPOST_MCP_TOKEN), so the harness never holds a
 * vendor's credential: Outpost swaps the token for the real one and counts the call in its Spend.
 *
 * Each vendor in its own words, at the model's lowest effort (found by asking it): OpenAI's models through Bedrock's Responses API,
 * Gemini through Vertex's, Claude through Bedrock's Anthropic Messages API. Replies are read whole (not streamed):
 * a cloud model's wait includes the network and the vendor's queue, so its first-token time means nothing here.
 */
import type { CloudSettings } from '@bench/models'

export interface WireCall {
    id: string
    type: 'function'
    function: { name: string; arguments: string }
    /** Gemini's thought signature for the call: sent back with it, as Gemini requires for tools. */
    extra_content?: unknown
}
export type ChatMessage =
    | { role: 'system' | 'user'; content: string }
    | { role: 'assistant'; content: string | null; tool_calls?: WireCall[] }
    | { role: 'tool'; tool_call_id: string; content: string }
export type OpenAITool = { type: 'function'; function: { name: string; description: string; parameters: unknown } }
export interface CloudReply {
    content: string
    calls: WireCall[]
    promptTokens: number | null
    generatedTokens: number | null
}

function gateway(): { base: string; token: string } {
    const url = process.env.OUTPOST_MCP_URL, token = process.env.OUTPOST_MCP_TOKEN
    if (!url || !token) throw new Error('cloud models run only in Outpost (no OUTPOST_MCP_URL / OUTPOST_MCP_TOKEN)')
    return { base: `${new URL(url).origin}/gw`, token }
}

async function post(path: string, body: unknown, signal: AbortSignal): Promise<any> {
    const { base, token } = gateway()
    const response = await fetch(`${base}/${path}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal })
    const text = await response.text()
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`)
    return JSON.parse(text)
}

/** OpenAI's chat completions shape (Bedrock's and Vertex's OpenAI-compatible APIs answer in it). */
function fromChatCompletion(answer: any): CloudReply {
    const message = answer.choices?.[0]?.message ?? {}
    const calls: WireCall[] = (message.tool_calls ?? []).map((call: any, index: number) => ({
        id: call.id || `call_${index}`,
        type: 'function',
        function: { name: call.function?.name ?? '', arguments: typeof call.function?.arguments === 'string' ? call.function.arguments : JSON.stringify(call.function?.arguments ?? {}) },
        ...(call.extra_content ? { extra_content: call.extra_content } : {}),
    }))
    return { content: typeof message.content === 'string' ? message.content : '', calls, promptTokens: answer.usage?.prompt_tokens ?? null, generatedTokens: answer.usage?.completion_tokens ?? null }
}

/** The conversation as Anthropic's Messages API takes it: the system prompt apart, tool calls and results as blocks. */
function anthropicMessages(messages: ChatMessage[]): { system: string; messages: any[] } {
    const system = messages.filter(message => message.role === 'system').map(message => message.content).join('\n\n')
    const out: { role: 'user' | 'assistant'; content: any[] }[] = []
    const add = (role: 'user' | 'assistant', blocks: any[]) => {
        const last = out.at(-1)
        if (last?.role === role) last.content.push(...blocks)
        else out.push({ role, content: blocks })
    }
    for (const message of messages) {
        if (message.role === 'user') add('user', [{ type: 'text', text: message.content }])
        else if (message.role === 'tool') add('user', [{ type: 'tool_result', tool_use_id: message.tool_call_id, content: message.content }])
        else if (message.role === 'assistant') {
            const blocks: any[] = message.content ? [{ type: 'text', text: message.content }] : []
            for (const call of message.tool_calls ?? []) {
                let input: unknown = {}
                try {
                    input = call.function.arguments.trim() ? JSON.parse(call.function.arguments) : {}
                } catch {}
                blocks.push({ type: 'tool_use', id: call.id, name: call.function.name, input })
            }
            if (blocks.length) add('assistant', blocks)
        }
    }
    return { system, messages: out }
}

// Each model's lowest effort, found by asking it: the model's own refusal says what it supports. Asked from the
// lowest any vendor has; kept for the rest of the run, so the row is named for the level every turn really ran at.
const LADDER = ['none', 'minimal', 'low', 'medium', 'high']
const lowest = new Map<string, string>()
export const effortUsed = (settings: CloudSettings): string => lowest.get(settings.model) ?? settings.effort
async function atLowest(settings: CloudSettings, call: (effort: string) => Promise<CloudReply>): Promise<CloudReply> {
    for (let effort = effortUsed(settings); ; ) {
        try {
            const reply = await call(effort)
            lowest.set(settings.model, effort)
            return reply
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            if (!/HTTP 400/.test(message) || !/effort/i.test(message)) throw error
            // "Supported values are: 'low', 'medium', …" names them; otherwise the next step up the ladder.
            const listed = message.match(/[Ss]upported values are:? ([^."]+)/)?.[1]?.match(/'([a-z]+)'/g)?.map(value => value.slice(1, -1))
            const next = listed?.length ? LADDER.find(value => listed.includes(value)) ?? listed[0] : LADDER[LADDER.indexOf(effort) + 1]
            if (!next || next === effort) throw error
            effort = next
        }
    }
}

/**
 * Before the script, untimed (as a local model reads the system prompt once on load): each level from the lowest any
 * vendor has, a short request with the system prompt and tools, and the first level that answers within 30 s is the
 * model's for the run. A level it refuses, or accepts and never answers (GPT-6.2 Sol at none), is passed over.
 */
export async function findLowest(settings: CloudSettings, system: string, tools: OpenAITool[]): Promise<string> {
    const probe: ChatMessage[] = [{ role: 'system', content: system }, { role: 'user', content: 'Ready?' }]
    let lastError = ''
    for (let index = LADDER.indexOf(settings.effort); index >= 0 && index < LADDER.length; index++) {
        const effort = LADDER[index]
        try {
            await callAt({ ...settings, effort }, probe, tools, AbortSignal.timeout(30_000))
            lowest.set(settings.model, effort)
            return effort
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error)
            const refusedEffort = /HTTP 400/.test(lastError) && /effort|thinking|reasoning/i.test(lastError)
            const tooSlow = /abort|timed? ?out/i.test(lastError)
            if (!refusedEffort && !tooSlow) throw error
        }
    }
    throw new Error(`no effort level answered: ${lastError.slice(0, 300)}`)
}

/** The conversation as OpenAI's Responses API takes it (Bedrock takes tools with a reasoning effort only there). */
function responsesInput(messages: ChatMessage[]): { instructions: string; input: any[] } {
    const instructions = messages.filter(message => message.role === 'system').map(message => message.content).join('\n\n')
    const input: any[] = []
    for (const message of messages) {
        if (message.role === 'user') input.push({ role: 'user', content: message.content })
        else if (message.role === 'tool') input.push({ type: 'function_call_output', call_id: message.tool_call_id, output: message.content })
        else if (message.role === 'assistant') {
            if (message.content) input.push({ role: 'assistant', content: message.content })
            for (const call of message.tool_calls ?? []) input.push({ type: 'function_call', call_id: call.id, name: call.function.name, arguments: call.function.arguments || '{}' })
        }
    }
    return { instructions, input }
}
function fromResponses(answer: any): CloudReply {
    const output: any[] = answer.output ?? []
    return {
        content: output.filter(item => item.type === 'message').flatMap(item => item.content ?? []).filter((part: any) => part.type === 'output_text').map((part: any) => part.text).join(''),
        calls: output.filter(item => item.type === 'function_call').map(item => ({ id: item.call_id, type: 'function', function: { name: item.name, arguments: item.arguments ?? '{}' } })),
        promptTokens: answer.usage?.input_tokens ?? null,
        generatedTokens: answer.usage?.output_tokens ?? null,
    }
}

export async function cloudStep(settings: CloudSettings, messages: ChatMessage[], tools: OpenAITool[], signal: AbortSignal): Promise<CloudReply> {
    return atLowest(settings, effort => callAt({ ...settings, effort }, messages, tools, signal))
}
async function callAt(settings: CloudSettings, messages: ChatMessage[], tools: OpenAITool[], signal: AbortSignal): Promise<CloudReply> {
    if (settings.api === 'anthropic') {
        const { system, messages: turns } = anthropicMessages(messages)
        const answer = await post(`${settings.provider}/model/${encodeURIComponent(settings.model)}/invoke`, {
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 4096,
            system,
            messages: turns,
            tools: tools.map(tool => ({ name: tool.function.name, description: tool.function.description, input_schema: tool.function.parameters })),
            output_config: { effort: settings.effort },
        }, signal)
        const blocks: any[] = answer.content ?? []
        return {
            content: blocks.filter(block => block.type === 'text').map(block => block.text).join(''),
            calls: blocks.filter(block => block.type === 'tool_use').map(block => ({ id: block.id, type: 'function', function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) } })),
            promptTokens: answer.usage?.input_tokens ?? null,
            generatedTokens: answer.usage?.output_tokens ?? null,
        }
    }
    if (settings.api === 'openai') {
        const { instructions, input } = responsesInput(messages)
        return fromResponses(await post(`${settings.provider}/openai/v1/responses`, {
            model: settings.model,
            instructions,
            input,
            tools: tools.map(tool => ({ type: 'function', name: tool.function.name, description: tool.function.description, parameters: tool.function.parameters })),
            reasoning: { effort: settings.effort },
            store: false,
        }, signal))
    }
    return fromChatCompletion(await post(`${settings.provider}/v1/endpoints/openapi/chat/completions`, { model: `google/${settings.model}`, messages, tools, reasoning_effort: settings.effort }, signal))
}
