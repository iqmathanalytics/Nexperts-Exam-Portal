import { createContext, useContext, useState, type ReactNode } from "react";

type AdminSearchContextValue = {
  query: string;
  setQuery: (value: string) => void;
  clearQuery: () => void;
};

const AdminSearchContext = createContext<AdminSearchContextValue | null>(null);

export function AdminSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");

  return (
    <AdminSearchContext.Provider
      value={{
        query,
        setQuery,
        clearQuery: () => setQuery(""),
      }}
    >
      {children}
    </AdminSearchContext.Provider>
  );
}

export function useAdminSearch() {
  const ctx = useContext(AdminSearchContext);
  if (!ctx) {
    throw new Error("useAdminSearch must be used within AdminSearchProvider");
  }
  return ctx;
}

/** Safe hook for optional use outside provider */
export function useAdminSearchQuery() {
  return useContext(AdminSearchContext)?.query ?? "";
}
