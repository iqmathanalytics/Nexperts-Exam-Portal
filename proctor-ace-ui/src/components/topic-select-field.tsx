import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiAuth } from "@/lib/api-auth";

const NEW_TOPIC = "__new_topic__";

type Props = {
  examId?: string;
  value: string;
  onChange: (topic: string) => void;
};

export function TopicSelectField({ examId, value, onChange }: Props) {
  const [topics, setTopics] = useState<string[]>([]);
  const [creatingNew, setCreatingNew] = useState(false);

  useEffect(() => {
    setCreatingNew(false);
    if (!examId) {
      setTopics([]);
      return;
    }
    let cancelled = false;
    apiAuth<{ topics: string[] }>(`/api/admin/questions/topics?examId=${encodeURIComponent(examId)}`)
      .then((d) => {
        if (!cancelled) setTopics(d.topics.filter((t) => t?.trim()));
      })
      .catch(() => {
        if (!cancelled) setTopics([]);
      });
    return () => {
      cancelled = true;
    };
  }, [examId]);

  const knownValue = value && topics.includes(value);
  const selectValue = creatingNew ? NEW_TOPIC : knownValue ? value : undefined;

  return (
    <div className="space-y-2">
      <Label>Topic</Label>
      {!examId ? (
        <p className="text-sm text-muted-foreground">Select an exam first to choose or create a topic.</p>
      ) : (
        <>
          <Select
            value={selectValue}
            onValueChange={(v) => {
              if (v === NEW_TOPIC) {
                setCreatingNew(true);
                onChange("");
              } else {
                setCreatingNew(false);
                onChange(v);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select or create topic" />
            </SelectTrigger>
            <SelectContent>
              {topics.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
              <SelectItem value={NEW_TOPIC} className="text-accent font-medium">
                + Create new topic…
              </SelectItem>
            </SelectContent>
          </Select>
          {(creatingNew || (value && !knownValue)) && (
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Enter new topic name"
            />
          )}
        </>
      )}
    </div>
  );
}
