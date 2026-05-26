import { env } from "../lib/env.js";

export type GeneratedQuestionDraft = {
  title: string;
  type: "Multiple Choice" | "True/False" | "Scenario";
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: string;
  topic: string;
  tags: string[];
};

export type GroqGenerateResult = {
  questions: GeneratedQuestionDraft[];
  source: "groq" | "template";
  fallbackReason?: string;
};

const VALID_TYPES = ["Multiple Choice", "True/False", "Scenario"] as const;

function normalizeType(raw: string, fallback: string): GeneratedQuestionDraft["type"] {
  const t = raw?.trim();
  if (t === "True/False" || t === "TRUE_FALSE" || t === "True False") return "True/False";
  if (t === "Scenario" || t === "SCENARIO") return "Scenario";
  if (t === "Multiple Choice" || t === "MULTIPLE_CHOICE" || t === "MCQ") return "Multiple Choice";
  const fb = fallback === "Mixed" ? "Multiple Choice" : fallback;
  if (VALID_TYPES.includes(fb as GeneratedQuestionDraft["type"])) {
    return fb as GeneratedQuestionDraft["type"];
  }
  return "Multiple Choice";
}

function parseJsonFromContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;
  const start = jsonText.indexOf("{");
  const arrStart = jsonText.indexOf("[");
  if (start === -1 && arrStart >= 0) {
    return JSON.parse(jsonText.slice(arrStart));
  }
  if (start >= 0) {
    const slice = arrStart >= 0 && arrStart < start ? jsonText.slice(arrStart) : jsonText.slice(start);
    return JSON.parse(slice);
  }
  return JSON.parse(jsonText);
}

function extractQuestionList(parsed: unknown): Record<string, unknown>[] {
  if (!parsed) return [];
  if (Array.isArray(parsed)) {
    return parsed.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
  }
  if (typeof parsed !== "object") return [];
  const obj = parsed as Record<string, unknown>;
  for (const key of ["questions", "items", "data", "results", "exam_questions"]) {
    if (Array.isArray(obj[key])) {
      return obj[key] as Record<string, unknown>[];
    }
  }
  if (obj.title || obj.question || obj.question_text) {
    return [obj];
  }
  return [];
}

function normalizeQuestion(
  raw: Record<string, unknown>,
  topic: string,
  difficulty: string,
  defaultType: string,
): GeneratedQuestionDraft | null {
  const title = String(raw.title ?? raw.question ?? raw.question_text ?? raw.stem ?? "").trim();
  if (title.length < 5) return null;

  const type = normalizeType(String(raw.type ?? defaultType), defaultType);
  let options = Array.isArray(raw.options)
    ? raw.options.map((o) => String(o).trim()).filter(Boolean)
    : Array.isArray(raw.choices)
      ? raw.choices.map((o) => String(o).trim()).filter(Boolean)
      : [];

  if (type === "True/False") {
    options = ["True", "False"];
  } else if (options.length < 2) {
    options = ["Option A", "Option B", "Option C", "Option D"];
  }

  const correctAnswer = String(raw.correctAnswer ?? raw.answer ?? raw.correct ?? options[0]).trim();
  const resolvedAnswer = options.includes(correctAnswer) ? correctAnswer : options[0];

  return {
    title,
    type,
    options,
    correctAnswer: resolvedAnswer,
    explanation: String(raw.explanation ?? "").trim() || `AI-generated for ${topic}.`,
    difficulty: String(raw.difficulty ?? difficulty).trim() || difficulty,
    topic: String(raw.topic ?? topic).trim() || topic,
    tags: Array.isArray(raw.tags) ? raw.tags.map((t) => String(t)) : ["ai-generated", "groq"],
  };
}

function templateFallback(
  topic: string,
  count: number,
  difficulty: string,
  questionType: string,
): GeneratedQuestionDraft[] {
  const types =
    questionType === "Mixed"
      ? (["Multiple Choice", "True/False", "Scenario"] as const)
      : ([normalizeType(questionType, "Multiple Choice")] as const);

  return Array.from({ length: count }, (_, i) => {
    const type = types[i % types.length];
    const options = type === "True/False" ? ["True", "False"] : ["Option A", "Option B", "Option C", "Option D"];
    const title =
      type === "True/False"
        ? `${topic}: Statement ${i + 1} — evaluate for certification context.`
        : type === "Scenario"
          ? `${topic}: Scenario ${i + 1} — choose the best architectural response.`
          : `${topic}: Which option best answers certification item ${i + 1}?`;
    return {
      title,
      type,
      options,
      correctAnswer: options[0],
      explanation: `Template fallback for "${topic}".`,
      difficulty,
      topic,
      tags: ["ai-generated", "template"],
    };
  });
}

async function callGroqApi(
  systemPrompt: string,
  userPrompt: string,
  useJsonMode: boolean,
): Promise<{ ok: true; content: string } | { ok: false; status: number; detail: string }> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.groqModel,
      temperature: 0.65,
      max_tokens: 8192,
      ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, status: res.status, detail: errText.slice(0, 500) };
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return { ok: false, status: 0, detail: "Empty response from Groq" };
  }
  return { ok: true, content };
}

function parseGroqContent(
  content: string,
  topic: string,
  difficulty: string,
  questionType: string,
  maxCount: number,
): GeneratedQuestionDraft[] {
  const parsed = parseJsonFromContent(content);
  const rawList = extractQuestionList(parsed);
  const defaultType = questionType === "Mixed" ? "Multiple Choice" : questionType;

  return rawList
    .map((item) => normalizeQuestion(item, topic, difficulty, defaultType))
    .filter((q): q is GeneratedQuestionDraft => q !== null)
    .slice(0, maxCount);
}

export async function generateQuestionsWithGroq(params: {
  topic: string;
  count: number;
  difficulty: string;
  questionType: string;
  sourceMaterial?: string;
}): Promise<GroqGenerateResult> {
  const { topic, count, difficulty, questionType, sourceMaterial } = params;
  const n = Math.min(50, Math.max(1, count));

  if (!env.groqApiKey?.trim()) {
    return {
      questions: templateFallback(topic, n, difficulty, questionType),
      source: "template",
      fallbackReason: "GROQ_API_KEY is not set in api/.env — restart the API server after adding it.",
    };
  }

  const typeInstruction =
    questionType === "Mixed"
      ? "Use a mix of Multiple Choice, True/False, and Scenario types."
      : `Use only "${questionType}" type.`;

  const systemPrompt = `You are an expert certification exam item writer.
Return ONLY valid JSON with no markdown and no extra text.
Schema: {"questions":[{"title":"string (full question text, at least 15 words)","type":"Multiple Choice|True/False|Scenario","options":["string"],"correctAnswer":"string","explanation":"string","difficulty":"string","topic":"string","tags":["string"]}]}
Rules:
- Generate exactly the requested number of questions in the questions array
- correctAnswer must exactly match one option string
- True/False must have options ["True","False"]
- Multiple Choice must have 4 distinct, realistic options
- Scenario questions must have 4 options representing actions or answers
- Professional, accurate, non-trivial certification items`;

  const materialBlock = sourceMaterial
    ? `\n\nUse the following reference material as the primary source (stay accurate to it):\n---\n${sourceMaterial.slice(0, 12000)}\n---`
    : "";

  const userPrompt = `Generate exactly ${n} exam questions.
Topic/syllabus: ${topic}
Difficulty: ${difficulty}
${typeInstruction}
Each question must include a tags array with 1-3 relevant tags.${materialBlock}`;

  try {
    let api = await callGroqApi(systemPrompt, userPrompt, true);
    if (!api.ok) {
      console.error("[Groq] API error:", api.status, api.detail);
      api = await callGroqApi(systemPrompt, userPrompt, false);
    }

    if (!api.ok) {
      return {
        questions: templateFallback(topic, n, difficulty, questionType),
        source: "template",
        fallbackReason: `Groq API error (${api.status}): ${api.detail}`,
      };
    }

    let questions = parseGroqContent(api.content, topic, difficulty, questionType, n);

    if (questions.length === 0) {
      const retry = await callGroqApi(
        systemPrompt,
        `${userPrompt}\n\nIMPORTANT: Return JSON only with a "questions" array of ${n} objects.`,
        false,
      );
      if (retry.ok) {
        questions = parseGroqContent(retry.content, topic, difficulty, questionType, n);
      }
    }

    if (questions.length === 0) {
      return {
        questions: templateFallback(topic, n, difficulty, questionType),
        source: "template",
        fallbackReason: "Could not parse questions from Groq response. Check API logs.",
      };
    }

    while (questions.length < n) {
      const more = templateFallback(topic, n - questions.length, difficulty, questionType);
      questions = [...questions, ...more];
    }

    return { questions: questions.slice(0, n), source: "groq" };
  } catch (e) {
    console.error("[Groq] generate failed:", e);
    return {
      questions: templateFallback(topic, n, difficulty, questionType),
      source: "template",
      fallbackReason: e instanceof Error ? e.message : "Unknown Groq error",
    };
  }
}

export function isGroqConfigured() {
  return Boolean(env.groqApiKey?.trim());
}
