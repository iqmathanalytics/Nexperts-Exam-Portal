import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  open: boolean;
  examTitle?: string;
  onStay: () => void;
  onEndAttempt: () => void;
};

export function ExamReloadDialog({ open, examTitle, onStay, onEndAttempt }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onStay(); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">Leave this exam?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-left">
            <span className="block">
              You are in an active proctored exam{examTitle ? ` (${examTitle})` : ""}. Leaving will
              <strong className="text-foreground"> end this attempt immediately</strong> and count it as a used attempt.
            </span>
            <span className="block text-muted-foreground">
              Your answers so far will be submitted and scored. Choose &quot;Stay on exam&quot; if you clicked refresh by mistake.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStay}>Stay on exam</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onEndAttempt}
          >
            End attempt and leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
