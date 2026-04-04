import { PAGINATION } from "@/lib/constants/app";

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const per_page = Math.min(PAGINATION.MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get("per_page") || String(PAGINATION.DEFAULT_PAGE_SIZE))));
  const from = (page - 1) * per_page;
  const to = from + per_page - 1;
  return { page, per_page, from, to };
}
