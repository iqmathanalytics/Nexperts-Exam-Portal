import type { QuestionFormState } from "@/lib/types";

/** Split CSV text into rows; supports quoted fields with commas and newlines. */
export function parseCsvRecords(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || (c === "\r" && text[i + 1] === "\n")) {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      if (c === "\r") i++;
    } else {
      field += c;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  return rows;
}

function normalizeHeader(cell: string) {
  return cell.trim().toLowerCase().replace(/\s+/g, "");
}

function cellAt(row: string[], headers: string[], name: string) {
  const idx = headers.indexOf(normalizeHeader(name));
  if (idx < 0) return "";
  return row[idx]?.trim() ?? "";
}

/**
 * Parse bulk CSV into question payloads.
 * Expected columns: title, code, type, topic, difficulty, option1–4, correctAnswer, explanation.
 * Legacy CSV without a `code` column is still supported (header-driven).
 */
export function parseQuestionCsv(text: string, examId?: string | null): QuestionFormState[] {
  const records = parseCsvRecords(text.trim());
  if (records.length < 2) return [];

  const headers = records[0].map(normalizeHeader);
  const hasTitle = headers.includes("title");
  const hasCorrect = headers.some((h) => h === "correctanswer");
  if (!hasTitle || !hasCorrect) return [];

  const dataRows = records.slice(1);

  return dataRows.map((cols) => {
    const title = cellAt(cols, headers, "title") || "Imported question";
    const codeRaw = cellAt(cols, headers, "code");
    const code = codeRaw ? codeRaw : null;
    const qType = (cellAt(cols, headers, "type") || "Multiple Choice") as QuestionFormState["type"];
    const topic = cellAt(cols, headers, "topic") || "General";
    const difficulty = cellAt(cols, headers, "difficulty") || "Intermediate";
    const o1 = cellAt(cols, headers, "option1");
    const o2 = cellAt(cols, headers, "option2");
    const o3 = cellAt(cols, headers, "option3");
    const o4 = cellAt(cols, headers, "option4");
    const correctAnswer = cellAt(cols, headers, "correctanswer");
    const explanation = cellAt(cols, headers, "explanation");

    let options: string[] = [];
    if (qType === "True/False") {
      options = ["True", "False"];
    } else {
      options = [o1, o2, o3, o4].filter(Boolean);
      if (options.length < 2) options = ["Option A", "Option B", "Option C", "Option D"];
    }

    return {
      examId: examId ?? undefined,
      title,
      code,
      type: qType,
      options,
      correctAnswer: correctAnswer || options[0],
      explanation,
      difficulty,
      topic,
      tags: ["imported"],
    };
  });
}

export const QUESTION_CSV_TEMPLATE = `title,code,type,topic,difficulty,option1,option2,option3,option4,correctAnswer,explanation
"What is the output?","print(sum([1, 2, 3]))","Multiple Choice","Python","Intermediate","5","6","7","8","6","sum([1,2,3]) is 6."
"Which query lists active users?","SELECT id, email FROM users WHERE status = 'active';","Multiple Choice","SQL","Intermediate","SELECT * FROM users","SELECT id, email FROM users WHERE status = 'active'","DELETE FROM users","UPDATE users SET active = 1","SELECT id, email FROM users WHERE status = 'active'","Filters by status column."
"HTTPS always uses port 443.","","True/False","Security","Beginner","True","False","","","True","HTTPS default port is 443."
`;

export function downloadCsvTemplate() {
  const blob = new Blob([QUESTION_CSV_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "questions-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}
