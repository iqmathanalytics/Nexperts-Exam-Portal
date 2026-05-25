import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

type Props = {
  open: boolean;
  examTitle?: string;
};

export function ViolationsLimitDialog({ open, examTitle }: Props) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md" onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-8 w-8 shrink-0" />
            <AlertDialogTitle className="font-display">Exam ended — 3 violations</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-2 text-left">
            <span className="block">
              You reached the maximum of <strong>3 proctoring violations</strong>
              {examTitle ? ` during ${examTitle}` : ""}. This attempt is being closed automatically.
            </span>
            <span className="block text-muted-foreground">
              Your answers will be submitted and scored. You may start a new attempt from My Exams if attempts remain.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>
  );
}
