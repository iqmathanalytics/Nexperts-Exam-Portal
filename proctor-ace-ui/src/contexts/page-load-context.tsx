import type { ReactNode } from "react";

export function PageLoadProvider({ children }: { children: ReactNode }) {
  return children;
}

export function usePageReady() {
  return true;
}

/** @deprecated Global page gate removed — pages handle their own loading UI. */
export function usePageLoading(_id: string, _loading: boolean) {
  /* no-op */
}

export { usePageDataLoad, useCandidateDataLoad, useInvalidateSession } from "@/hooks/use-session-query";
