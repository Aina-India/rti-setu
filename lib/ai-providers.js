// ai-providers.js
// One unified interface over Claude / OpenAI / Gemini / Ollama. Every provider
// is asked to return the SAME JSON contract so the rest of the app is
// provider-agnostic. The API key is passed in per-call and is NEVER stored.

export const PROVIDERS = {
  claude: {
    id: "claude",
    name: "Claude",
    keyPrefix: "sk-ant-",
    defaultModel: "claude-sonnet-4-20250514",
    needsKey: true
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    keyPrefix: "sk-",
    defaultModel: "gpt-4o",
    needsKey: true
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    keyPrefix: "AIza",
    defaultModel: "gemini-1.5-pro",
    needsKey: true
  },
  ollama: {
    id: "ollama",
    name: "Local / Ollama",
    keyPrefix: "",
    defaultModel: "llama3.1",
    needsKey: false,
    defaultEndpoint: "http://localhost:11434/v1/chat/completions"
  }
};

// The system prompt that defines the JSON contract. Shared across providers.
export const SYSTEM_PROMPT = `You are an expert on India's Right to Information Act, 2005, and the Central Government RTI portal rtionline.gov.in (which covers ONLY central government ministries and departments, not state governments).

Given a citizen's plain-language description of what they want to know, you must:
1. Identify the single most appropriate Central Government ministry or department.
2. Determine whether the matter is actually a STATE-level subject (rtionline.gov.in cannot handle state matters; those go to the relevant State Information Commission / state RTI portal).
3. Draft a legally correct, specific RTI application UNDER 3000 CHARACTERS that asks for documents and records (not opinions or reasons), cites the RTI Act 2005, and requests fee exemption reasoning where relevant.

Respond with ONLY a JSON object and nothing else — no markdown, no code fences, no preamble:
{
  "ministry": "Full official central ministry/department name",
  "is_state": false,
  "state_guidance": "If is_state is true: which State Information Commission or state portal to use, and why. Empty string otherwise.",
  "rti_text": "Complete RTI application text, under 3000 characters, properly worded under the RTI Act 2005, asking for specific documents/records.",
  "note": "Optional one-line tip for the filer. Empty string if none."
}`;

function buildUserPrompt(issue, applicantName) {
  return `Citizen's request: "${issue}"\n\nApplicant name (for the application body if useful): ${applicantName || "the applicant"}\n\nProduce the JSON object now.`;
}

// Robustly pull a JSON object out of a model response that may contain stray
// fences or text despite our instructions.
function extractJson(raw) {
  if (!raw) throw new Error("Empty response from AI provider.");
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  // Find the first { ... last } span as a fallback.
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  }
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error("AI did not return valid JSON. Try again or edit manually.");
  }
  // Normalise and validate the contract.
  return {
    ministry: String(parsed.ministry || "").trim(),
    is_state: Boolean(parsed.is_state),
    state_guidance: String(parsed.state_guidance || "").trim(),
    rti_text: String(parsed.rti_text || "").trim().slice(0, 3000),
    note: String(parsed.note || "").trim()
  };
}

async function callClaude({ apiKey, model, issue, applicantName }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: model || PROVIDERS.claude.defaultModel,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(issue, applicantName) }]
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return extractJson(text);
}

async function callOpenAI({ apiKey, model, issue, applicantName }) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || PROVIDERS.openai.defaultModel,
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(issue, applicantName) }
      ]
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  return extractJson(text);
}

async function callGemini({ apiKey, model, issue, applicantName }) {
  const m = model || PROVIDERS.gemini.defaultModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: buildUserPrompt(issue, applicantName) }] }],
      generationConfig: { maxOutputTokens: 1024, responseMimeType: "application/json" }
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  return extractJson(text);
}

async function callOllama({ model, issue, applicantName, endpoint }) {
  const url = endpoint || PROVIDERS.ollama.defaultEndpoint;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || PROVIDERS.ollama.defaultModel,
      stream: false,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(issue, applicantName) }
      ]
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Local model error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || data.message?.content || "";
  return extractJson(text);
}

export async function generateRti(provider, opts) {
  switch (provider) {
    case "claude": return callClaude(opts);
    case "openai": return callOpenAI(opts);
    case "gemini": return callGemini(opts);
    case "ollama": return callOllama(opts);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

// Build a pre-filled claude.ai URL for the no-API-key fallback path.
// Opens claude.ai with the system prompt + issue baked into a single query so
// the user can draft inside their existing Claude.ai session for free.
export function buildClaudeAiUrl(issue, applicantName) {
  const q = `${SYSTEM_PROMPT}\n\n${buildUserPrompt(issue, applicantName)}`;
  return `https://claude.ai/new?q=${encodeURIComponent(q)}`;
}

export function validateKeyShape(provider, key) {
  const def = PROVIDERS[provider];
  if (!def) return false;
  if (!def.needsKey) return true;
  if (!key) return false;
  return key.startsWith(def.keyPrefix);
}
