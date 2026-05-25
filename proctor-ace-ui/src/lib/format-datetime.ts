import { format } from "date-fns";

export function formatAttemptDate(iso: string) {
  return format(new Date(iso), "dd MMM yyyy");
}

export function formatAttemptTime(iso: string) {
  return format(new Date(iso), "h:mm a");
}

export function formatAttemptDateTime(iso: string) {
  return format(new Date(iso), "dd MMM yyyy, h:mm a");
}
