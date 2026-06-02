const FILTER_ALL = "all";

export function buildAdminQuestionsQuery(params: {
  filterExamId: string;
  search?: string;
  filterType?: string;
  filterTopic?: string;
  filterDifficulty?: string;
  limit?: number;
  offset?: number;
  all?: boolean;
}) {
  const qs = new URLSearchParams();
  if (params.filterExamId !== FILTER_ALL) qs.set("examId", params.filterExamId);
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.filterType && params.filterType !== FILTER_ALL) qs.set("type", params.filterType);
  if (params.filterTopic && params.filterTopic !== FILTER_ALL) qs.set("topic", params.filterTopic);
  if (params.filterDifficulty && params.filterDifficulty !== FILTER_ALL) {
    qs.set("difficulty", params.filterDifficulty);
  }
  if (params.all) {
    qs.set("all", "1");
  } else {
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const QB_INITIAL_LIMIT = 20;
export const QB_LOAD_MORE_LIMIT = 50;
