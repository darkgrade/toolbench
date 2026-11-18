/**
 * One step of a cloud model (models.ts CLOUD_MODELS): the conversation so far and Studio's tools in, its reply and
 * tool calls out, in the same shape a local model's streamed reply is read into. It goes through Outpost's model
 * gateway with the worker's own Outpost token (OUTPOST_MCP_URL, OUTPOST_MCP_TOKEN), so the harness never holds a
 * vendor's credential: Outpost swaps the token for the real one and counts the call in its Spend.
 *
 * Each vendor in its own words, at its lowest effort: OpenAI's models through Bedrock's OpenAI-compatible chat API,
 * Gemini through Vertex's, Claude through Bedrock's Anthropic Messages API. Replies are read whole (not streamed):
 * a cloud model's wait includes the network and the vendor's queue, so its first-token time means nothing here.
 */
import type { CloudSettings } from '@bench/models'

export interface WireCall {
    id: string
    type: 'function'
    function: { name: string; arguments: string }
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

export async function cloudStep(settings: CloudSettings, messages: ChatMessage[], tools: OpenAITool[], signal: AbortSignal): Promise<CloudReply> {
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
    if (settings.api === 'openai')
        return fromChatCompletion(await post(`${settings.provider}/openai/v1/chat/completions`, { model: settings.model, messages, tools, reasoning_effort: settings.effort }, signal))
    return fromChatCompletion(await post(`${settings.provider}/v1/endpoints/openapi/chat/completions`, { model: `google/${settings.model}`, messages, tools, reasoning_effort: settings.effort }, signal))
}
