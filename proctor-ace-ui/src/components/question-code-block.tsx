type CodeLanguage = "python" | "sql" | "code";

export function detectCodeLanguage(code: string): CodeLanguage {
  const t = code.trim();
  if (!t) return "code";
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|ALTER|DROP|MERGE|TRUNCATE)\b/im.test(t)) {
    return "sql";
  }
  if (/^\s*(def |import |from |class |print\(|if __name__|for .+ in |while )/m.test(t)) {
    return "python";
  }
  return "code";
}

const languageLabels: Record<CodeLanguage, string> = {
  python: "Python",
  sql: "SQL",
  code: "Code snippet",
};

type Props = {
  code: string | null | undefined;
  className?: string;
};

/** Renders optional question code (Python, SQL, etc.) below the question text. */
export function QuestionCodeBlock({ code, className }: Props) {
  const trimmed = code?.trim();
  if (!trimmed) return null;

  const lang = detectCodeLanguage(trimmed);

  return (
    <div className={className ?? "mt-3 space-y-1.5"}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {languageLabels[lang]}
      </p>
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted/60 p-4 font-mono text-[13px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
        <code>{trimmed}</code>
      </pre>
    </div>
  );
}
