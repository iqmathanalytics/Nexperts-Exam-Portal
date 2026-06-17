import { useEffect, useState } from "react";
import { IdCard, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiAuth } from "@/lib/api-auth";

type IdentityPhotoData = {
  photo: string | null;
  selfiePhoto?: string | null;
  idPhoto?: string | null;
  candidate: string;
  exam: string;
  capturedAt: string;
};

type Props = {
  attemptId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function IdentityPhotoDialog({ attemptId, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<IdentityPhotoData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !attemptId) {
      setData(null);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    apiAuth<IdentityPhotoData>(`/api/admin/attempts/${attemptId}/identity-photo`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load identity verification photo.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, attemptId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <IdCard className="h-5 w-5 text-accent" />
            Identity verification
          </DialogTitle>
          <DialogDescription>
            Photo captured at exam start — candidate face and ID should both be visible.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </p>
        )}

        {!loading && !error && data && (
          <div className="space-y-3">
            <div className="text-sm">
              <p className="font-medium">{data.candidate}</p>
              <p className="text-muted-foreground">{data.exam}</p>
              <p className="text-xs text-muted-foreground">
                Captured {new Date(data.capturedAt).toLocaleString()}
              </p>
            </div>
            {data.selfiePhoto || data.idPhoto || data.photo ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.selfiePhoto && (
                  <div className="overflow-hidden rounded-xl border border-border bg-muted">
                    <div className="border-b border-border bg-background px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Selfie
                    </div>
                    <img src={data.selfiePhoto} alt="Candidate selfie" className="max-h-[360px] w-full object-contain" />
                  </div>
                )}
                {(data.idPhoto || data.photo) && (
                  <div className="overflow-hidden rounded-xl border border-border bg-muted">
                    <div className="border-b border-border bg-background px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      MyKad / ID
                    </div>
                    <img
                      src={data.idPhoto ?? data.photo ?? ""}
                      alt="Candidate MyKad or ID"
                      className="max-h-[360px] w-full object-contain"
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No identity photos were captured for this attempt.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
