"use client";

import { useState, useMemo } from "react";
import { useRevenueEntries, useDeleteRevenueEntry, useConfirmRevenueEntry, useCancelRevenueEntry } from "../hooks/use-revenue";
import { useContracts } from "@/lib/hooks/use-contracts";
import { useI18n } from "@/lib/i18n";
import { formatVND, formatDate } from "@/lib/utils/format";
import { EmptyState, Button } from "@/components/shared";
import { toast } from "sonner";
import { Check, X, Trash2, ChevronLeft, ChevronRight, Coins, Zap, AlertTriangle, FileText } from "lucide-react";
import type { RevenueEntryStatus } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-yellow-500/10 text-yellow-600",
  confirmed: "bg-green-500/10 text-green-600",
  adjusted: "bg-blue-500/10 text-blue-600",
  cancelled: "bg-red-500/10 text-red-500 line-through",
};

interface Props {
  filters: Record<string, string | undefined>;
  canManage: boolean;
}

export function RevenueTable({ filters, canManage }: Props) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState("-created_at");
  const perPage = 20;

  const { data: res, isLoading } = useRevenueEntries({ ...filters, page, per_page: perPage, sort: sortCol } as any);
  const manualEntries = res?.data ?? [];
  const total = res?.count ?? 0;
  const totalPages = Math.ceil(total / perPage);

  // HĐ đầu ra active/completed — áp dụng tất cả filters tương ứng
  const { data: allContracts = [] } = useContracts();
  const contractRows = useMemo(() => {
    return (allContracts as any[])
      .filter((c) => c.contract_type === "outgoing" && ["active", "completed"].includes(c.status))
      .filter((c) => {
        if (filters.project_id && c.project_id !== filters.project_id) return false;
        if (filters.contract_id && c.id !== filters.contract_id) return false;
        if (filters.bid_package && c.bid_package !== filters.bid_package) return false;
        if (filters.product_service_id && c.product_service_id !== filters.product_service_id) return false;
        if (filters.date_from && (c.signed_date || c.start_date) && (c.signed_date || c.start_date) < filters.date_from) return false;
        if (filters.date_to && (c.signed_date || c.start_date) && (c.signed_date || c.start_date) > filters.date_to) return false;
        return true;
      })
      .map((c) => {
        const addendumTotal = (c.addendums ?? []).reduce((s: number, a: any) => s + Number(a.value_change || 0), 0);
        return {
          id: `ct-${c.id}`,
          isContract: true,
          description: c.title,
          contract_no: c.contract_no,
          status: c.status,
          source: "contract" as string,
          project: c.project,
          recognition_date: c.signed_date || c.start_date,
          amount: Number(c.contract_value) + addendumTotal,
          contract_scope: c.contract_scope || "internal",
          product_service_name: c.product_service?.name || null,
          bid_package: c.bid_package,
        };
      });
  }, [allContracts, filters]);

  // Bảng chỉ hiện dòng HĐ — giá trị đã bao gồm phụ lục, không cần entries riêng
  const entries = contractRows;

  const confirmEntry = useConfirmRevenueEntry();
  const cancelEntry = useCancelRevenueEntry();
  const deleteEntry = useDeleteRevenueEntry();

  // Modal xác nhận trước khi xóa/huỷ — thay thế browser confirm()
  const [pendingAction, setPendingAction] = useState<{ type: "delete" | "cancel" | "confirm"; id: string; desc: string } | null>(null);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      draft: t.revenue.statusDraft,
      confirmed: t.revenue.statusConfirmed,
      adjusted: t.revenue.statusAdjusted,
      cancelled: t.revenue.statusCancelled,
    };
    return map[s] || s;
  };

  const sourceLabel = (s: string) => {
    const map: Record<string, string> = {
      billing_milestone: t.revenue.sourceBilling,
      acceptance: t.revenue.sourceAcceptance,
      manual: t.revenue.sourceManual,
    };
    return map[s] || s;
  };

  const handleSort = (col: string) => {
    setSortCol(sortCol === col ? `-${col}` : col);
    setPage(1);
  };

  const executeAction = async () => {
    if (!pendingAction) return;
    const { type, id } = pendingAction;
    try {
      if (type === "delete") { await deleteEntry.mutateAsync(id); toast.success("Đã xóa doanh thu"); }
      if (type === "cancel") { await cancelEntry.mutateAsync(id); toast.success("Đã xóa doanh thu"); }
      if (type === "confirm") { await confirmEntry.mutateAsync(id); toast.success("Đã xác nhận doanh thu"); }
    } catch (e: any) { toast.error(e.message); }
    setPendingAction(null);
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-8 bg-secondary rounded animate-pulse" />)}
      </div>
    );
  }

  if (entries.length === 0) {
    return <EmptyState icon={<Coins size={32} strokeWidth={1.5} />} title={t.revenue.noEntries} subtitle={t.revenue.noEntriesSub} />;
  }

  const SortHeader = ({ col, children }: { col: string; children: React.ReactNode }) => {
    const dir = sortCol === col ? "ascending" : sortCol === `-${col}` ? "descending" : undefined;
    return (
      <th className="text-left px-4 py-2.5 font-medium">
        <button type="button" onClick={() => handleSort(col)} aria-sort={dir}
          className="inline-flex items-center gap-1 hover:text-foreground select-none focus-ring rounded">
          {children} {dir === "ascending" ? "↑" : dir === "descending" ? "↓" : ""}
        </button>
      </th>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <SortHeader col="description">{t.revenue.description}</SortHeader>
            <th className="text-left px-4 py-2.5 font-medium">{t.contracts.status}</th>
            <th className="text-left px-4 py-2.5 font-medium">{t.revenue.source}</th>
            <th className="text-left px-4 py-2.5 font-medium">{t.revenue.selectProject}</th>
            <SortHeader col="recognition_date">{t.revenue.recognitionDate}</SortHeader>
            <SortHeader col="amount">{t.revenue.amount}</SortHeader>
            <th className="text-left px-4 py-2.5 font-medium">Loại hình</th>
            <th className="text-left px-4 py-2.5 font-medium">Lĩnh vực</th>
            {canManage && <th className="text-right px-4 py-2.5 font-medium w-24" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {entries.map((e: any) => (
            <tr key={e.id} className={`hover:bg-secondary/20 transition-colors ${e.isContract ? "bg-blue-500/5" : ""}`}>
              <td className="px-4 py-2.5 font-medium max-w-[220px] truncate">
                {e.isContract && <FileText size={11} className="inline mr-1 text-primary" />}
                {e.isContract ? `${e.contract_no} — ${e.description}` : e.description}
              </td>
              <td className="px-4 py-2.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${e.isContract ? "bg-blue-500/10 text-blue-600" : STATUS_STYLE[e.status ?? "draft"]}`}>
                  {e.isContract ? "Hợp đồng" : statusLabel(e.status ?? "draft")}
                </span>
              </td>
              <td className="px-4 py-2.5">
                {e.isContract ? (
                  <span className="text-muted-foreground">Hợp đồng đầu ra</span>
                ) : (
                  <>
                    <span className="text-muted-foreground">{sourceLabel(e.source ?? "manual")}</span>
                    {e.source !== "manual" && (
                      <span className="ml-1 inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-medium">
                        <Zap size={8} aria-hidden="true" />{t.revenue.autoSource}
                      </span>
                    )}
                  </>
                )}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{e.project?.code || "—"}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{formatDate(e.recognition_date ?? null)}</td>
              <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatVND(Number(e.amount))}</td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {(e.isContract ? e.contract_scope : e.contract?.contract_scope) === "external" ? "Ngoài hệ thống" : "Trong hệ thống"}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {e.product_service_name || (e as any).product_service?.name || "—"}
              </td>
              {canManage && (
                <td className="px-4 py-2.5 text-right">
                  {!e.isContract ? (
                    <div className="flex items-center justify-end gap-1">
                      {e.status === "draft" && (
                        <>
                          <button onClick={() => setPendingAction({ type: "confirm", id: e.id, desc: e.description })} className="p-1 rounded hover:bg-green-500/10 text-green-600" title={t.revenue.confirm}><Check size={13} /></button>
                          <button onClick={() => setPendingAction({ type: "delete", id: e.id, desc: e.description })} className="p-1 rounded hover:bg-red-500/10 text-destructive" title={t.common.delete}><Trash2 size={13} /></button>
                        </>
                      )}
                      {e.status === "confirmed" && (
                        <button onClick={() => setPendingAction({ type: "cancel", id: e.id, desc: e.description })} className="p-1 rounded hover:bg-red-500/10 text-destructive" title={t.revenue.cancel}><X size={13} /></button>
                      )}
                    </div>
                  ) : null}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-border text-xs text-muted-foreground">
          <span>{total} {t.revenue.totalRevenue.toLowerCase()}</span>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1 rounded hover:bg-secondary disabled:opacity-30"><ChevronLeft size={14} /></button>
            <span>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-1 rounded hover:bg-secondary disabled:opacity-30"><ChevronRight size={14} /></button>
          </div>
        </div>
      )}

      {/* Modal xác nhận xóa/huỷ doanh thu */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setPendingAction(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center space-y-4">
              <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${pendingAction.type === "confirm" ? "bg-green-500/10" : "bg-destructive/10"}`}>
                <AlertTriangle size={24} className={pendingAction.type === "confirm" ? "text-green-500" : "text-destructive"} />
              </div>
              <div>
                <h3 className="text-base font-bold">
                  {pendingAction.type === "delete" ? "Xóa doanh thu" : pendingAction.type === "cancel" ? "Xóa doanh thu" : "Xác nhận doanh thu"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {pendingAction.type === "delete" && "Doanh thu này sẽ bị xóa vĩnh viễn."}
                  {pendingAction.type === "cancel" && "Doanh thu đã xác nhận sẽ bị xóa khỏi danh sách."}
                  {pendingAction.type === "confirm" && "Doanh thu sẽ được xác nhận và ghi nhận chính thức."}
                </p>
                <p className="text-sm font-medium mt-2 truncate">"{pendingAction.desc}"</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
              <Button onClick={() => setPendingAction(null)}>Hủy</Button>
              <Button
                variant={pendingAction.type === "confirm" ? "primary" : "destructive"}
                onClick={executeAction}
                disabled={deleteEntry.isPending || cancelEntry.isPending || confirmEntry.isPending}
              >
                {pendingAction.type === "confirm" ? "Xác nhận" : "Xóa doanh thu"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
