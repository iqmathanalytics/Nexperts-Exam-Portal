import { useRef } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { downloadCsvTemplate } from "@/lib/parse-question-csv";

const CSV_DESCRIPTION =
  "Columns: title, code, type, topic, difficulty, option1–4, correctAnswer, explanation. Leave code empty when not needed.";

type Props = {
  value: string;
  onChange: (text: string) => void;
  /** Shown when parsed row count is known */
  parsedCount?: number;
  parsedCountLabel?: string;
  textareaRows?: number;
  id?: string;
};

export function QuestionCsvBulkInput({
  value,
  onChange,
  parsedCount,
  parsedCountLabel = "question(s) ready to import",
  textareaRows = 8,
  id = "question-csv-file",
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv" && file.type !== "") {
      toast.error("Please choose a .csv file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{CSV_DESCRIPTION}</p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          id={id}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            onFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          Upload CSV file
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={downloadCsvTemplate}>
          Download template
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Or paste CSV below</Label>
        <Textarea
          rows={textareaRows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste CSV from the template (header row required)…"
          className="font-mono text-xs"
        />
      </div>

      {parsedCount !== undefined && parsedCount > 0 && (
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
          {parsedCount} {parsedCountLabel}
        </p>
      )}
    </div>
  );
}
