"use client";

import { useState, useMemo } from "react";
import { useProjects } from "@/lib/hooks/use-projects";
import {
  useContracts, useCreateContract, useUpdateContract, useDeleteContract,
  useCreateAddendum, useDeleteAddendum,
  useCreateBillingMilestone, useUpdateBillingMilestone, useDeleteBillingMilestone,
} from "@/lib/hooks/use-contracts";
import { useAuthStore } from "@/lib/stores";
import { Button, EmptyState } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { useI18n } from "@/lib/i18n";
import { formatVND, formatDate } from "@/lib/utils/format";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Contract, ContractAddendum, BillingMilestone } from "@/lib/types";

const supabase = createClient();

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8", active: "#3b82f6", completed: "#10b981", terminated: "#ef4444",
};
const MILESTONE_STATUS_COLORS: Record<string, string> = {
  upcoming: "#94a3b8", invoiced: "#f59e0b", paid: "#10b981", overdue: "#ef4444",
};

export default function ContractsPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const { data: projects = [] } = useProjects();
  const [filterProjectId, setFilterProjectId] = useState<string>("all");
  const { data: contracts = [] } = useContracts(filterProjectId !== "all" ? filterProjectId : undefined);
  const canManage = user && ["admin", "leader", "director"].includes(user.role);

  // Create contract form
  const [showForm, setShowForm] = useState(false);
  const createContract = useCreateContract();
  const [form, setForm] = useState({
    project_id: "", contract_no: "", title: "", client_name: "",
    contract_value: 0, signed_date: "", start_date: "", end_date: "",
    guarantee_value: 0, guarantee_expiry: "", status: "draft" as string, notes: "",
  });

  const handleCreate = async () => {
    if (!form.project_id || !form.contract_no || !form.title || !form.contract_value) {
      toast.error("Vui lòng nhập đủ thông tin bắt buộc");
      return;
    }
    try {
      const { project_id, contract_no, title, client_name, contract_value, signed_date, start_date, end_date, guarantee_value, guarantee_expiry, status, notes } = form;
      await createContract.mutateAsync({
        project_id, contract_no, title,
        client_name: client_name || undefined,
        contract_value,
        signed_date: signed_date || undefined,
        start_date: start_date || undefined,
        end_date: end_date || undefined,
        guarantee_value: guarantee_value || undefined,
        guarantee_expiry: guarantee_expiry || undefined,
        status,
        notes: notes || undefined,
      });
      toast.success("Tạo hợp đồng thành công!");
      setShowForm(false);
      setForm({ project_id: "", contract_no: "", title: "", client_name: "", contract_value: 0, signed_date: "", start_date: "", end_date: "", guarantee_value: 0, guarantee_expiry: "", status: "draft", notes: "" });
    } catch (e: any) {
      toast.error(e.message || "Lỗi tạo hợp đồng");
    }
  };

  // File upload handler
  const uploadFile = async (file: File, prefix: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${prefix}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("contract-files").upload(path, file, { cacheControl: "3600" });
    if (error) { toast.error("Lỗi upload file"); return null; }
    const { data } = supabase.storage.from("contract-files").getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <p className="text-sm text-muted-foreground">{t.contracts.subtitle}</p>

      {/* Filter + Action */}
      <div className="flex items-center justify-between gap-3">
        <div className="w-64">
          <SearchSelect
            value={filterProjectId}
            onChange={setFilterProjectId}
            options={[
              { value: "all", label: t.contracts.allProjects },
              ...projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
            ]}
            placeholder={t.contracts.selectProject}
          />
        </div>
        {canManage && (
          <Button variant="primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? t.common.cancel : t.contracts.newContract}
          </Button>
        )}
      </div>

      {/* Create Form */}
      {showForm && canManage && (
        <div className="bg-card border-2 border-primary/30 rounded-xl p-5 space-y-4 animate-slide-in-bottom">
          <h3 className="text-base font-bold text-primary">{t.contracts.newContract}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.contracts.selectProject} *</label>
              <SearchSelect
                value={form.project_id}
                onChange={(v) => setForm({ ...form, project_id: v })}
                options={projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
                placeholder={t.contracts.selectProject}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.contracts.contractNo} *</label>
              <input value={form.contract_no} onChange={(e) => setForm({ ...form, contract_no: e.target.value })} placeholder="HD-2026-001" className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.contracts.status}</label>
              <SearchSelect
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v })}
                options={[
                  { value: "draft", label: t.contracts.statusDraft },
                  { value: "active", label: t.contracts.statusActive },
                  { value: "completed", label: t.contracts.statusCompleted },
                  { value: "terminated", label: t.contracts.statusTerminated },
                ]}
                className="mt-1"
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm text-muted-foreground font-medium">{t.contracts.contractTitle} *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.contracts.clientName}</label>
              <input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.contracts.contractValue} *</label>
              <input type="number" min={0} value={form.contract_value || ""} onChange={(e) => setForm({ ...form, contract_value: +e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base font-mono focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.contracts.signedDate}</label>
              <input type="date" value={form.signed_date} onChange={(e) => setForm({ ...form, signed_date: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.contracts.startDate}</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.contracts.endDate}</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.contracts.guaranteeValue}</label>
              <input type="number" min={0} value={form.guarantee_value || ""} onChange={(e) => setForm({ ...form, guarantee_value: +e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base font-mono focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.contracts.guaranteeExpiry}</label>
              <input type="date" value={form.guarantee_expiry} onChange={(e) => setForm({ ...form, guarantee_expiry: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
            </div>
            <div className="col-span-3">
              <label className="text-sm text-muted-foreground font-medium">{t.contracts.notes}</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
            <Button variant="primary" onClick={handleCreate} disabled={createContract.isPending}>
              {createContract.isPending ? t.contracts.creating : t.contracts.createContract}
            </Button>
          </div>
        </div>
      )}

      {/* Contract List */}
      {contracts.length === 0 ? (
        <EmptyState icon="📄" title={t.contracts.noContracts} subtitle={t.contracts.noContractsSub} />
      ) : (
        <div className="space-y-4">
          {contracts.map((c) => (
            <ContractCard key={c.id} contract={c} canManage={!!canManage} uploadFile={uploadFile} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───── PDF / File Viewer ───────────────────────────────────────── */

function ContractFileViewer({ url, label }: { url: string; label: string }) {
  const [showViewer, setShowViewer] = useState(false);
  const isPdf = /\.pdf(\?|$)/i.test(url);

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">{label}:</span>
        {isPdf ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowViewer(!showViewer); }}
            className="text-xs text-primary hover:underline font-medium"
          >
            {showViewer ? "Ẩn PDF" : "Xem PDF"}
          </button>
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Xem file</a>
        )}
        <a href={url} download className="text-xs text-muted-foreground hover:underline">Tải về</a>
      </div>
      {showViewer && isPdf && (
        <div className="mt-2 rounded-lg border border-border overflow-hidden bg-secondary/30">
          <iframe
            src={`${url}#toolbar=1&navpanes=0`}
            className="w-full h-[500px]"
            title="Contract PDF"
          />
        </div>
      )}
    </div>
  );
}

/* ───── Contract Card (expandable) ─────────────────────────────── */

function ContractCard({ contract: c, canManage, uploadFile }: {
  contract: Contract;
  canManage: boolean;
  uploadFile: (file: File, prefix: string) => Promise<string | null>;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const deleteContract = useDeleteContract();
  const updateContract = useUpdateContract();

  // Calculate addendum-adjusted value
  const addendums = c.addendums || [];
  const milestones = c.milestones || [];
  const addendumTotal = addendums.reduce((s, a) => s + Number(a.value_change), 0);
  const currentValue = Number(c.contract_value);
  const statusColor = CONTRACT_STATUS_COLORS[c.status] || "#94a3b8";
  const statusLabel = (t.contracts as any)[`status${c.status.charAt(0).toUpperCase() + c.status.slice(1)}`] || c.status;

  // Billing summary
  const totalInvoiced = milestones.filter((m) => ["invoiced", "paid"].includes(m.status)).reduce((s, m) => s + Number(m.amount), 0);
  const totalPaid = milestones.filter((m) => m.status === "paid").reduce((s, m) => s + Number(m.amount), 0);
  const overdueCount = milestones.filter((m) => m.status === "overdue" || (m.status === "upcoming" && m.due_date && new Date(m.due_date) < new Date())).length;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-secondary/20 transition-colors"
      >
        <svg className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="m9 18 6-6-6-6" /></svg>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">{c.contract_no}</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: `${statusColor}20`, color: statusColor }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
              {statusLabel}
            </span>
          </div>
          <p className="text-sm font-semibold truncate mt-0.5">{c.title}</p>
          {c.client_name && <p className="text-[11px] text-muted-foreground">{c.client_name}</p>}
        </div>
        <div className="flex-shrink-0 text-right space-y-0.5">
          <p className="text-sm font-bold font-mono">{formatVND(currentValue)}</p>
          {addendumTotal !== 0 && (
            <p className={`text-[10px] font-mono ${addendumTotal > 0 ? "text-primary" : "text-destructive"}`}>
              {addendumTotal > 0 ? "+" : ""}{formatVND(addendumTotal)} ({addendums.length} PL)
            </p>
          )}
        </div>
        <div className="flex-shrink-0 text-right w-28">
          <p className="text-[11px] text-muted-foreground">{c.start_date ? formatDate(c.start_date) : "—"} → {c.end_date ? formatDate(c.end_date) : "—"}</p>
          {overdueCount > 0 && (
            <p className="text-[10px] text-destructive font-medium mt-0.5">{overdueCount} {t.contracts.overdueAlert}</p>
          )}
        </div>
        {c.project && (
          <span className="flex-shrink-0 px-2 py-0.5 rounded bg-secondary text-[10px] text-muted-foreground font-medium">{c.project.code}</span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border animate-slide-in-bottom">
          {/* Contract details row */}
          <div className="px-4 py-3 bg-secondary/20 grid grid-cols-4 gap-4 text-xs">
            {c.guarantee_value > 0 && (
              <div>
                <span className="text-muted-foreground">{t.contracts.guarantee}</span>
                <p className="font-mono font-semibold">{formatVND(Number(c.guarantee_value))}</p>
                {c.guarantee_expiry && <p className="text-muted-foreground">{t.contracts.guaranteeExpiry}: {formatDate(c.guarantee_expiry)}</p>}
              </div>
            )}
            {c.file_url && (
              <div className="col-span-4">
                <ContractFileViewer url={c.file_url} label={t.contracts.file} />
              </div>
            )}
            {c.notes && (
              <div className="col-span-2">
                <span className="text-muted-foreground">{t.contracts.notes}</span>
                <p>{c.notes}</p>
              </div>
            )}
          </div>

          {/* File upload + Delete */}
          {canManage && (
            <div className="px-4 py-2 border-t border-border/30 flex items-center gap-2">
              <label className="text-[11px] text-primary cursor-pointer hover:underline">
                {t.contracts.uploadFile}
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await uploadFile(file, `contracts/${c.id}`);
                  if (url) {
                    updateContract.mutate({ id: c.id, file_url: url } as any);
                    toast.success("Upload thành công!");
                  }
                }} />
              </label>
              <div className="flex-1" />
              <button
                onClick={() => { if (confirm(t.contracts.confirmDelete.replace("{name}", c.title))) deleteContract.mutate(c.id); }}
                className="text-[11px] text-destructive hover:underline"
              >
                {t.common.delete}
              </button>
            </div>
          )}

          {/* Addendums section */}
          <AddendumSection contractId={c.id} addendums={addendums} canManage={canManage} uploadFile={uploadFile} />

          {/* Billing Milestones section */}
          <BillingSection contractId={c.id} contractValue={currentValue} milestones={milestones} canManage={canManage} />
        </div>
      )}
    </div>
  );
}

/* ───── Addendums ──────────────────────────────────────────────── */

function AddendumSection({ contractId, addendums, canManage, uploadFile }: {
  contractId: string;
  addendums: ContractAddendum[];
  canManage: boolean;
  uploadFile: (file: File, prefix: string) => Promise<string | null>;
}) {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const create = useCreateAddendum();
  const remove = useDeleteAddendum();
  const [form, setForm] = useState({ addendum_no: "", title: "", value_change: 0, new_end_date: "", description: "", signed_date: "" });

  const handleCreate = async () => {
    if (!form.addendum_no || !form.title) { toast.error("Nhập số phụ lục và tên"); return; }
    try {
      await create.mutateAsync({
        contract_id: contractId,
        addendum_no: form.addendum_no,
        title: form.title,
        value_change: form.value_change,
        new_end_date: form.new_end_date || undefined,
        description: form.description || undefined,
        signed_date: form.signed_date || undefined,
      });
      toast.success("Tạo phụ lục thành công!");
      setShowForm(false);
      setForm({ addendum_no: "", title: "", value_change: 0, new_end_date: "", description: "", signed_date: "" });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="border-t border-border">
      <div className="px-4 py-2 flex items-center justify-between bg-secondary/10">
        <h4 className="text-xs font-bold">{t.contracts.addendums} ({addendums.length})</h4>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)} className="text-[11px] text-primary font-medium hover:underline">
            {showForm ? t.common.cancel : t.contracts.newAddendum}
          </button>
        )}
      </div>

      {showForm && (
        <div className="px-4 py-3 bg-primary/5 border-t border-border/30 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground">{t.contracts.addendumNo}</label>
              <input value={form.addendum_no} onChange={(e) => setForm({ ...form, addendum_no: e.target.value })} placeholder="PL-01" className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{t.contracts.addendumTitle}</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{t.contracts.valueChange}</label>
              <input type="number" value={form.value_change || ""} onChange={(e) => setForm({ ...form, value_change: +e.target.value })} className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs font-mono focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{t.contracts.newEndDate}</label>
              <input type="date" value={form.new_end_date} onChange={(e) => setForm({ ...form, new_end_date: e.target.value })} className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{t.contracts.signedDate}</label>
              <input type="date" value={form.signed_date} onChange={(e) => setForm({ ...form, signed_date: e.target.value })} className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
            </div>
            <div className="flex items-end">
              <Button size="sm" variant="primary" onClick={handleCreate} disabled={create.isPending}>
                {create.isPending ? t.contracts.creatingAddendum : t.contracts.createAddendum}
              </Button>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">{t.contracts.description}</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
          </div>
        </div>
      )}

      {addendums.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-t border-border/30 text-muted-foreground">
              <th className="text-left px-4 py-1.5 font-medium">{t.contracts.addendumNo}</th>
              <th className="text-left px-4 py-1.5 font-medium">{t.contracts.addendumTitle}</th>
              <th className="text-right px-4 py-1.5 font-medium">{t.contracts.valueChange}</th>
              <th className="text-left px-4 py-1.5 font-medium">{t.contracts.signedDate}</th>
              {canManage && <th className="text-right px-4 py-1.5 font-medium w-16" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {addendums.map((a) => (
              <tr key={a.id} className="hover:bg-secondary/20">
                <td className="px-4 py-1.5 font-mono">{a.addendum_no}</td>
                <td className="px-4 py-1.5">{a.title}</td>
                <td className={`px-4 py-1.5 text-right font-mono font-semibold ${Number(a.value_change) >= 0 ? "text-primary" : "text-destructive"}`}>
                  {Number(a.value_change) >= 0 ? "+" : ""}{formatVND(Number(a.value_change))}
                </td>
                <td className="px-4 py-1.5 text-muted-foreground">{formatDate(a.signed_date)}</td>
                {canManage && (
                  <td className="px-4 py-1.5 text-right">
                    <button
                      onClick={() => { if (confirm(t.contracts.confirmDeleteAddendum.replace("{name}", a.title))) remove.mutate({ id: a.id, contract_id: contractId }); }}
                      className="text-destructive hover:underline text-[10px]"
                    >{t.common.delete}</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {addendums.length === 0 && !showForm && (
        <p className="px-4 py-2 text-[11px] text-muted-foreground">{t.contracts.noAddendums}</p>
      )}
    </div>
  );
}

/* ───── Billing Milestones ─────────────────────────────────────── */

function BillingSection({ contractId, contractValue, milestones, canManage }: {
  contractId: string;
  contractValue: number;
  milestones: BillingMilestone[];
  canManage: boolean;
}) {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const create = useCreateBillingMilestone();
  const update = useUpdateBillingMilestone();
  const remove = useDeleteBillingMilestone();
  const [form, setForm] = useState({ title: "", percentage: 0, amount: 0, due_date: "", invoice_no: "", notes: "" });

  const sorted = useMemo(() => [...milestones].sort((a, b) => a.sort_order - b.sort_order), [milestones]);
  const totalPct = sorted.reduce((s, m) => s + Number(m.percentage), 0);
  const totalInvoiced = sorted.filter((m) => ["invoiced", "paid"].includes(m.status)).reduce((s, m) => s + Number(m.amount), 0);
  const totalPaid = sorted.filter((m) => m.status === "paid").reduce((s, m) => s + Number(m.amount), 0);

  const handleCreate = async () => {
    if (!form.title || !form.percentage) { toast.error("Nhập tên mốc và tỷ lệ %"); return; }
    try {
      await create.mutateAsync({
        contract_id: contractId,
        title: form.title,
        percentage: form.percentage,
        amount: form.amount || Math.round(contractValue * form.percentage / 100),
        due_date: form.due_date || undefined,
        invoice_no: form.invoice_no || undefined,
        sort_order: sorted.length,
        notes: form.notes || undefined,
      });
      toast.success("Tạo mốc thanh toán thành công!");
      setShowForm(false);
      setForm({ title: "", percentage: 0, amount: 0, due_date: "", invoice_no: "", notes: "" });
    } catch (e: any) { toast.error(e.message); }
  };

  const statusLabel = (s: string) => (t.contracts as any)[`milestone${s.charAt(0).toUpperCase() + s.slice(1)}`] || s;

  return (
    <div className="border-t border-border">
      <div className="px-4 py-2 flex items-center justify-between bg-secondary/10">
        <h4 className="text-xs font-bold">{t.contracts.billingMilestones} ({sorted.length})</h4>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)} className="text-[11px] text-primary font-medium hover:underline">
            {showForm ? t.common.cancel : t.contracts.newMilestone}
          </button>
        )}
      </div>

      {/* Summary bar */}
      {sorted.length > 0 && (
        <div className="px-4 py-2 bg-secondary/20 flex items-center gap-4 text-[11px]">
          <span className="text-muted-foreground">{t.contracts.totalBilled}: <span className="font-semibold text-foreground font-mono">{formatVND(totalInvoiced)}</span></span>
          <span className="text-muted-foreground">{t.contracts.totalPaid}: <span className="font-semibold text-primary font-mono">{formatVND(totalPaid)}</span></span>
          <span className="text-muted-foreground">{t.contracts.totalRemaining}: <span className="font-semibold text-foreground font-mono">{formatVND(contractValue - totalPaid)}</span></span>
          <div className="flex-1" />
          <span className="text-muted-foreground">Tổng %: <span className={`font-semibold font-mono ${totalPct > 100 ? "text-destructive" : "text-foreground"}`}>{totalPct.toFixed(1)}%</span></span>
        </div>
      )}

      {showForm && (
        <div className="px-4 py-3 bg-primary/5 border-t border-border/30">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground">{t.contracts.milestoneTitle}</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Tạm ứng" className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{t.contracts.percentage}</label>
              <input
                type="number" min={0} max={100} step={0.1}
                value={form.percentage || ""}
                onChange={(e) => {
                  const pct = +e.target.value;
                  setForm({ ...form, percentage: pct, amount: Math.round(contractValue * pct / 100) });
                }}
                className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs font-mono focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{t.contracts.amount}</label>
              <input type="number" min={0} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: +e.target.value })} className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs font-mono focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{t.contracts.dueDate}</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
            </div>
          </div>
          <div className="flex items-end gap-3 mt-2">
            <div className="flex-1">
              <label className="text-[11px] text-muted-foreground">{t.contracts.notes}</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
            </div>
            <Button size="sm" variant="primary" onClick={handleCreate} disabled={create.isPending}>
              {create.isPending ? t.contracts.creatingMilestone : t.contracts.createMilestone}
            </Button>
          </div>
        </div>
      )}

      {sorted.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-t border-border/30 text-muted-foreground">
              <th className="text-left px-4 py-1.5 font-medium">{t.contracts.milestoneTitle}</th>
              <th className="text-right px-4 py-1.5 font-medium">%</th>
              <th className="text-right px-4 py-1.5 font-medium">{t.contracts.amount}</th>
              <th className="text-left px-4 py-1.5 font-medium">{t.contracts.dueDate}</th>
              <th className="text-left px-4 py-1.5 font-medium">{t.contracts.status}</th>
              {canManage && <th className="text-right px-4 py-1.5 font-medium w-32" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {sorted.map((m) => {
              const isOverdue = m.status === "upcoming" && m.due_date && new Date(m.due_date) < new Date();
              const effectiveStatus = isOverdue ? "overdue" : m.status;
              const color = MILESTONE_STATUS_COLORS[effectiveStatus] || "#94a3b8";
              return (
                <tr key={m.id} className={`hover:bg-secondary/20 ${isOverdue ? "bg-destructive/5" : ""}`}>
                  <td className="px-4 py-2">{m.title}</td>
                  <td className="px-4 py-2 text-right font-mono">{Number(m.percentage).toFixed(1)}%</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold">{formatVND(Number(m.amount))}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(m.due_date)}</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: `${color}20`, color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                      {statusLabel(effectiveStatus)}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-2 text-right space-x-2">
                      {(effectiveStatus === "upcoming" || effectiveStatus === "overdue") && (
                        <button
                          onClick={() => update.mutate({ id: m.id, status: "invoiced" })}
                          className="text-[10px] text-primary hover:underline"
                        >{t.contracts.markInvoiced}</button>
                      )}
                      {effectiveStatus === "invoiced" && (
                        <button
                          onClick={() => update.mutate({ id: m.id, status: "paid", paid_date: new Date().toISOString().split("T")[0] })}
                          className="text-[10px] text-primary hover:underline"
                        >{t.contracts.markPaid}</button>
                      )}
                      <button
                        onClick={() => { if (confirm(t.contracts.confirmDeleteMilestone.replace("{name}", m.title))) remove.mutate(m.id); }}
                        className="text-[10px] text-destructive hover:underline"
                      >{t.common.delete}</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {sorted.length === 0 && !showForm && (
        <p className="px-4 py-2 text-[11px] text-muted-foreground">{t.contracts.noMilestones}</p>
      )}
    </div>
  );
}
