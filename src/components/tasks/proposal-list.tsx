"use client";

import { useState } from "react";
import { useProposals, useApproveProposal, useRejectProposal } from "@/lib/hooks/use-proposals";
import { useAuthStore } from "@/lib/stores";
import { Button, UserAvatar, PriorityBadge } from "@/components/shared";
import { ROLE_CONFIG, formatDate } from "@/lib/utils/kpi";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, FileText } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Chờ duyệt", color: "#f59e0b", icon: Clock },
  approved: { label: "Đã duyệt", color: "#10b981", icon: CheckCircle },
  rejected: { label: "Từ chối", color: "#ef4444", icon: XCircle },
};

export function ProposalList({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<string>("pending");
  const { data: proposals = [], isLoading } = useProposals(tab);
  const approveProposal = useApproveProposal();
  const rejectProposal = useRejectProposal();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);

  const selectedProposal = proposals.find((p: any) => p.id === selectedId);
  const isApprover = (p: any) => user && p.approver_id === user.id;
  const isProposer = (p: any) => user && p.proposed_by === user.id;

  const handleApprove = async (id: string) => {
    try {
      await approveProposal.mutateAsync(id);
      setSelectedId(null);
    } catch (err: any) {
      toast.error(err.message || "Lỗi duyệt");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectProposal.mutateAsync({ proposalId: id, reason: rejectReason });
      setShowRejectForm(null);
      setRejectReason("");
      setSelectedId(null);
    } catch (err: any) {
      toast.error(err.message || "Lỗi từ chối");
    }
  };

  const tabs = [
    { key: "pending", label: "Chờ duyệt" },
    { key: "approved", label: "Đã duyệt" },
    { key: "rejected", label: "Từ chối" },
    { key: "all", label: "Tất cả" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="w-[560px] bg-card border-l border-border h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-bold flex items-center gap-2">
            <FileText size={18} />
            Đề xuất giao việc
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelectedId(null); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-secondary rounded-lg animate-pulse" />)}
            </div>
          ) : proposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText size={40} className="text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Không có đề xuất nào</p>
            </div>
          ) : selectedId && selectedProposal ? (
            /* Detail View */
            <div className="p-5 space-y-4">
              <button onClick={() => setSelectedId(null)} className="text-xs text-primary hover:underline">← Quay lại</button>

              <div>
                <h4 className="text-lg font-bold">{selectedProposal.title}</h4>
                {selectedProposal.description && (
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{selectedProposal.description}</p>
                )}
              </div>

              {/* Status badge */}
              {(() => {
                const cfg = STATUS_CONFIG[selectedProposal.status] || STATUS_CONFIG.pending;
                const Icon = cfg.icon;
                return (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: `${cfg.color}20`, color: cfg.color }}>
                    <Icon size={14} />
                    {cfg.label}
                  </div>
                );
              })()}

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-[11px] text-muted-foreground uppercase font-semibold mb-1">Người đề xuất</p>
                  {selectedProposal.proposer && (
                    <div className="flex items-center gap-2">
                      <UserAvatar name={selectedProposal.proposer.full_name} color={(ROLE_CONFIG as any)[selectedProposal.proposer.role]?.color} size="sm" />
                      <div>
                        <p className="text-sm font-semibold">{selectedProposal.proposer.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">{(ROLE_CONFIG as any)[selectedProposal.proposer.role]?.label}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-[11px] text-muted-foreground uppercase font-semibold mb-1">Người duyệt</p>
                  {selectedProposal.approver && (
                    <div className="flex items-center gap-2">
                      <UserAvatar name={selectedProposal.approver.full_name} color={(ROLE_CONFIG as any)[selectedProposal.approver.role]?.color} size="sm" />
                      <div>
                        <p className="text-sm font-semibold">{selectedProposal.approver.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">{(ROLE_CONFIG as any)[selectedProposal.approver.role]?.label}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Ưu tiên: </span>{selectedProposal.priority && <PriorityBadge priority={selectedProposal.priority} />}</div>
                <div><span className="text-muted-foreground">Trọng số: </span><span className="font-mono">W:{selectedProposal.kpi_weight}</span></div>
                {selectedProposal.project && (
                  <div className="col-span-2"><span className="text-muted-foreground">Dự án: </span><span className="font-mono text-primary">{selectedProposal.project.code} — {selectedProposal.project.name}</span></div>
                )}
                <div><span className="text-muted-foreground">Bắt đầu: </span>{formatDate(selectedProposal.start_date)}</div>
                <div><span className="text-muted-foreground">Deadline: </span>{formatDate(selectedProposal.deadline)}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Ngày đề xuất: </span>{formatDate(selectedProposal.created_at)}</div>
              </div>

              {/* Reject reason */}
              {selectedProposal.status === "rejected" && selectedProposal.reject_reason && (
                <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-3">
                  <p className="text-xs font-semibold text-destructive mb-1">Lý do từ chối:</p>
                  <p className="text-sm">{selectedProposal.reject_reason}</p>
                </div>
              )}

              {/* Approve/Reject buttons (only for approver, only if pending) */}
              {isApprover(selectedProposal) && selectedProposal.status === "pending" && (
                <div className="space-y-3 pt-2 border-t border-border">
                  {showRejectForm === selectedProposal.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Lý do từ chối (tùy chọn)..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm resize-none focus:border-primary focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => { setShowRejectForm(null); setRejectReason(""); }}>Hủy</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleReject(selectedProposal.id)} disabled={rejectProposal.isPending}>
                          {rejectProposal.isPending ? "..." : "Xác nhận từ chối"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="primary" onClick={() => handleApprove(selectedProposal.id)} disabled={approveProposal.isPending} className="flex-1">
                        <CheckCircle size={16} className="mr-1.5" />
                        {approveProposal.isPending ? "Đang duyệt..." : "Duyệt & Tạo công việc"}
                      </Button>
                      <Button variant="destructive" onClick={() => setShowRejectForm(selectedProposal.id)} className="flex-1">
                        <XCircle size={16} className="mr-1.5" />
                        Từ chối
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* List View */
            <div className="divide-y divide-border/40">
              {proposals.map((p: any) => {
                const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
                const Icon = cfg.icon;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className="w-full px-5 py-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors text-left"
                  >
                    <div className="flex-shrink-0">
                      <Icon size={18} style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isApprover(p) && (
                          <span className="text-[10px] text-muted-foreground">
                            Đề xuất bởi: {p.proposer?.full_name}
                          </span>
                        )}
                        {isProposer(p) && (
                          <span className="text-[10px] text-muted-foreground">
                            Gửi đến: {p.approver?.full_name}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">· {formatDate(p.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {p.priority && <PriorityBadge priority={p.priority} />}
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${cfg.color}20`, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
