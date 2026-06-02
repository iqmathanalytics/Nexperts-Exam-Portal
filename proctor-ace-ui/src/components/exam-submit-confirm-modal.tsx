import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  examTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ExamSubmitConfirmModal({ open, examTitle, onCancel, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-elevated select-none">
        <div className="flex items-start gap-4">
          <AlertTriangle className="mt-0.5 h-10 w-10 shrink-0 text-amber-500" />
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">Submit exam?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You are about to submit <span className="font-medium text-foreground">{examTitle}</span>.
              After confirmation, fullscreen will close and your answers will be scored. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse">
          <Button className="bg-gradient-emerald text-white" onClick={onConfirm}>
            Yes, submit exam
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Continue exam
          </Button>
        </div>
      </div>
    </div>
  );
}
