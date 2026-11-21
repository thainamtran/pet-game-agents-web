import { requireLlmKey } from "./config.js";

export class LLMError extends Error {
  constructor(message) {
    super(message);
    this.name = "LLMError";
  }
}

export function extractJson(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : raw;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new LLMError(`Could not parse JSON from model output: ${raw.slice(0, 400)}`);
  }
}

export async function complete(settings, { system, user, jsonMode = false }) {
  const key = requireLlmKey(settings);
  const body = {
    model: settings.openaiModel,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.3,
  };
  if (jsonMode) body.response_format = { type: "json_object" };
  let response;
  try {
    response = await fetch(`${settings.openaiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new LLMError(`LLM request failed: ${err.message}`);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new LLMError(`LLM HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 500)}`);
  }
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new LLMError(`Unexpected LLM response shape: ${JSON.stringify(payload).slice(0, 400)}`);
  }
  return content;
}

export async function completeJson(settings, { system, user }) {
  return extractJson(await complete(settings, { system, user, jsonMode: true }));
}
