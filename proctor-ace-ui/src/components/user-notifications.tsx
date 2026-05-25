import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, CreditCard, Award } from "lucide-react";
import { apiAuth } from "@/lib/api-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ApiError } from "@/lib/api-client";
import { toast } from "sonner";

type Notification = {
  id: string;
  type: "payment_pending" | "certificate";
  title: string;
  message: string;
  createdAt: string;
  paymentId?: string;
  credentialId?: string;
  read: boolean;
};

export function UserNotifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [resuming, setResuming] = useState<string | null>(null);

  const load = () => {
    apiAuth<{ notifications: Notification[]; unreadCount: number }>("/api/candidate/notifications")
      .then((d) => {
        setItems(d.notifications);
        setUnread(d.unreadCount);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const resumePayment = async (paymentId: string) => {
    setResuming(paymentId);
    try {
      const res = await apiAuth<{ url?: string }>(`/api/payments/${paymentId}/resume`, {
        method: "POST",
      });
      if (res.url) window.location.href = res.url;
      else toast.error("No checkout URL returned");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not resume payment");
    } finally {
      setResuming(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <div className="font-display font-semibold">Notifications</div>
          {unread > 0 && (
            <p className="text-xs text-muted-foreground">{unread} pending payment{unread > 1 ? "s" : ""}</p>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</p>
          ) : (
            items.map((n) => (
              <div key={n.id} className="border-b border-border/60 px-4 py-3 last:border-0">
                <div className="flex items-start gap-2">
                  {n.type === "payment_pending" ? (
                    <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  ) : (
                    <Award className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{n.title}</span>
                      {!n.read && <Badge variant="destructive" className="h-4 px-1 text-[9px]">New</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                    {n.type === "payment_pending" && n.paymentId && (
                      <Button
                        size="sm"
                        className="mt-2 h-7 bg-gradient-emerald text-white text-xs"
                        disabled={resuming === n.paymentId}
                        onClick={() => resumePayment(n.paymentId!)}
                      >
                        {resuming === n.paymentId ? "Opening…" : "Resume payment"}
                      </Button>
                    )}
                    {n.type === "certificate" && n.credentialId && (
                      <Link
                        to="/certificate/$credentialId"
                        params={{ credentialId: n.credentialId }}
                        className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
                        onClick={() => setOpen(false)}
                      >
                        View certificate
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
            <Link to="/dashboard/payments" onClick={() => setOpen(false)}>All payments</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
