import { useEffect, useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoader } from "@/components/page-loader";

type TabDef = { value: string; label: string; content: ReactNode };

type Props = {
  tabs: TabDef[];
  defaultValue?: string;
  className?: string;
};

export function LoadingTabs({ tabs, defaultValue, className }: Props) {
  const [active, setActive] = useState(defaultValue ?? tabs[0]?.value ?? "");
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    setSwitching(true);
    const t = setTimeout(() => setSwitching(false), 220);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <Tabs value={active} onValueChange={setActive} className={className}>
      <TabsList>
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="relative mt-4 min-h-[160px]">
        {switching && <PageLoader overlay label="Loading…" />}
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-0 rounded-xl border bg-card p-4">
            {!switching && t.content}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
