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
  onReload: () => void;
};

export function ExamReloadDialog({ open, examTitle, onStay, onReload }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onStay(); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">Reload this page?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-left">
            <span className="block">
              You are in an active proctored exam{examTitle ? ` (${examTitle})` : ""}. Reloading will
              <strong className="text-foreground"> end this attempt immediately</strong> and count it as a used attempt.
            </span>
            <span className="block text-muted-foreground">
              Your answers so far may be submitted as-is and scored. If you clicked reload by mistake, choose
              &quot;Stay on exam&quot; to continue.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStay}>Stay on exam</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onReload}
          >
            Reload and end attempt
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
