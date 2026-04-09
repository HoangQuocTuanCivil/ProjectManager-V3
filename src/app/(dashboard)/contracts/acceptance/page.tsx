"use client";

import { useState, useMemo } from "react";
import { useContracts, useCreateBillingMilestone, useUpdateBillingMilestone, useDeleteBillingMilestone } from "@/features/contracts";
import { useAuthStore } from "@/lib/stores";
import { Button, EmptyState } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { ClipboardCheck, Pencil, Trash2 } from "lucide-react";
import { formatVND, formatDate } from "@/lib/utils/format";
import { toast } from "sonner";

const STATUS_STYLE: Record<string, string> = {
  upcoming: "bg-blue-500/10 text-blue-600",
  invoiced: "bg-yellow-500/10 text-yellow-600",
  paid: "bg-green-500/10 text-green-600",
  overdue: "bg-red-500/10 text-red-500",
};
const STATUS_LABEL: Record<string, string> = {
  upcoming: "Chờ NT", invoiced: "Đã nghiệm thu", paid: "Đã thanh toán", overdue: "Quá hạn",
};

export default function AcceptancePage() {
  const { user } = useAuthStore();
  const { data: contracts = [] } = useContracts();
  const createMilestone = useCreateBillingMilestone();
  const updateMilestone = useUpdateBillingMilestone();
  const deleteMilestone = useDeleteBillingMilestone();
  const canManage = !!user && ["admin", "leader", "director"].includes(user.role);

  const [filterContract, setFilterContract] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Hợp đồng đầu ra đang hoạt động — dùng cho dropdown tạo mới
  const activeContracts = useMemo(() =>
    (contracts as any[]).filter((c) => c.contract_type === "outgoing" && ["active", "completed"].includes(c.status)),
    [contracts]
  );

  // Gộp milestones từ mọi HĐ, kèm thông tin HĐ + dự án
  const milestones = useMemo(() => {
    const result: any[] = [];
    for (const c of contracts as any[]) {
      for (const m of c.milestones ?? []) {
        if (filterContract && c.id !== filterContract) continue;
        if (filterStatus && m.status !== filterStatus) continue;
        result.push({ ...m, contract: c, project: c.project });
      }
    }
    return result.sort((a, b) => {
      const order = { overdue: 0, upcoming: 1, invoiced: 2, paid: 3 };
      return (order[a.status as keyof typeof order] ?? 9) - (order[b.status as keyof typeof order] ?? 9);
    });
  }, [contracts, filterContract, filterStatus]);

  // Thống kê tổng hợp
  const stats = useMemo(() => ({
    total: milestones.length,
    totalAmount: milestones.reduce((s, m) => s + Number(m.amount), 0),
    totalPayable: milestones.reduce((s, m) => s + Number(m.payable_amount || 0), 0),
    totalPaid: milestones.reduce((s, m) => s + Number(m.paid_amount || 0), 0),
    overdue: milestones.filter((m) => m.status === "overdue").length,
  }), [milestones]);

  return (
    <div className="space-y-5 animate-fade-in">
      <p className="text-sm text-muted-foreground">
        Quản lý nghiệm thu, theo dõi giá trị được thanh toán và đã thanh toán theo từng đợt
      </p>

      {/* Thống kê */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: filterContract || filterStatus ? "Số đợt (lọc)" : "Tổng đợt", value: String(stats.total), color: "" },
          { label: "Giá trị nghiệm thu", value: formatVND(stats.totalAmount), color: "text-blue-500" },
          { label: "Được thanh toán", value: formatVND(stats.totalPayable), color: "text-amber-500" },
          { label: "Đã thanh toán", value: formatVND(stats.totalPaid), color: "text-green-500" },
          { label: "Quá hạn", value: String(stats.overdue), color: stats.overdue > 0 ? "text-red-500" : "" },
        ].map((c, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground">{c.label}</p>
            <p className={`text-lg font-bold font-mono ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filter + nút tạo mới */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-64">
            <SearchSelect value={filterContract} onChange={setFilterContract}
              options={[
                { value: "", label: "Tất cả hợp đồng" },
                ...(contracts as any[]).map((c) => ({ value: c.id, label: `${c.contract_no} — ${c.title}` })),
              ]} placeholder="Lọc hợp đồng" />
          </div>
          <div className="w-44">
            <SearchSelect value={filterStatus} onChange={setFilterStatus}
              options={[
                { value: "", label: "Tất cả trạng thái" },
                { value: "upcoming", label: "Chờ NT" },
                { value: "invoiced", label: "Đã nghiệm thu" },
                { value: "paid", label: "Đã thanh toán" },
                { value: "overdue", label: "Quá hạn" },
              ]} />
          </div>
        </div>
        {canManage && (
          <Button variant="primary" onClick={() => setShowCreate(true)}>+ Tạo nghiệm thu</Button>
        )}
      </div>

      {/* Modal tạo mới nghiệm thu */}
      {showCreate && <CreateAcceptanceModal
        contracts={activeContracts}
        onCreate={createMilestone}
        onClose={() => setShowCreate(false)}
      />}

      {/* Bảng nghiệm thu */}
      {milestones.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={32} strokeWidth={1.5} />} title="Chưa có đợt nghiệm thu" subtitle="Nhấn '+ Tạo nghiệm thu' để thêm đợt mới" />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {["Đợt nghiệm thu", "Hợp đồng", "GT nghiệm thu", "Ngày NT", "GT được TT", "GT đã TT", "Ngày TT", "Trạng thái", ""].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {milestones.map((m) => (
                editingId === m.id ? (
                  <EditPaymentRow key={m.id} milestone={m} onSave={updateMilestone} onCancel={() => setEditingId(null)} />
                ) : (
                  <tr key={m.id} className={`hover:bg-secondary/20 transition-colors ${m.status === "overdue" ? "bg-red-500/5" : ""}`}>
                    <td className="px-4 py-2.5 font-medium">{m.title}</td>
                    <td className="px-4 py-2.5 text-muted-foreground font-mono text-[11px]">{m.contract?.contract_no}</td>
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-500">{formatVND(Number(m.amount))}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(m.due_date)}</td>
                    <td className="px-4 py-2.5 font-mono text-amber-500">{Number(m.payable_amount) > 0 ? formatVND(Number(m.payable_amount)) : "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-green-500">{Number(m.paid_amount) > 0 ? formatVND(Number(m.paid_amount)) : "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.paid_date ? formatDate(m.paid_date) : "—"}</td>
                    <td className="px-4 py-2.5">
                      {canManage ? (
                        <select
                          value={m.status}
                          onChange={(e) => {
                            const newStatus = e.target.value;
                            const updates: any = { id: m.id, status: newStatus };
                            if (newStatus === "paid" && !m.paid_date) updates.paid_date = new Date().toISOString().split("T")[0];
                            updateMilestone.mutate(updates, {
                              onSuccess: () => toast.success(`Trạng thái → ${STATUS_LABEL[newStatus]}`),
                              onError: (err) => toast.error(err.message),
                            });
                          }}
                          className={`h-7 px-2 rounded border border-border bg-secondary text-[11px] font-medium focus:border-primary focus:outline-none cursor-pointer ${STATUS_STYLE[m.status]?.split(" ")[1] || ""}`}
                        >
                          {Object.entries(STATUS_LABEL).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLE[m.status]}`}>
                          {STATUS_LABEL[m.status]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {canManage && (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setEditingId(m.id)} className="text-primary hover:underline text-[10px] flex items-center gap-0.5">
                            <Pencil size={10} /> Sửa
                          </button>
                          <button onClick={() => { if (confirm(`Xoá đợt "${m.title}"?`)) deleteMilestone.mutate(m.id); }}
                            className="text-destructive hover:underline text-[10px]">
                            <Trash2 size={10} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Modal tạo mới nghiệm thu ──────────────────────────────────── */

function CreateAcceptanceModal({ contracts, onCreate, onClose }: {
  contracts: any[];
  onCreate: ReturnType<typeof useCreateBillingMilestone>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    contract_id: "", title: "", amount: 0, due_date: "",
    payable_amount: 0, paid_amount: 0, paid_date: "",
  });

  const inputCls = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";
  const labelCls = "text-sm text-muted-foreground font-medium";

  const handleSubmit = async () => {
    if (!form.contract_id || !form.title || !form.amount || !form.due_date) {
      toast.error("Vui lòng nhập đủ: Hợp đồng, Đợt NT, Giá trị NT, Ngày NT");
      return;
    }
    try {
      await onCreate.mutateAsync({
        contract_id: form.contract_id,
        title: form.title,
        amount: form.amount,
        percentage: 0,
        due_date: form.due_date,
        ...(form.payable_amount > 0 ? { payable_amount: form.payable_amount } : {}),
        ...(form.paid_amount > 0 ? { paid_amount: form.paid_amount, paid_date: form.paid_date || new Date().toISOString().split("T")[0] } : {}),
      } as any);
      toast.success("Tạo đợt nghiệm thu thành công!");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Lỗi tạo nghiệm thu");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-bold text-primary">Tạo đợt nghiệm thu</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Hàng 1: Hợp đồng + Đợt nghiệm thu */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Hợp đồng *</label>
              <SearchSelect
                value={form.contract_id}
                onChange={(v) => setForm({ ...form, contract_id: v })}
                options={contracts.map((c: any) => ({ value: c.id, label: `${c.contract_no} — ${c.title}`, sublabel: formatVND(Number(c.contract_value)) }))}
                placeholder="Chọn hợp đồng" className="mt-1"
              />
            </div>
            <div>
              <label className={labelCls}>Đợt nghiệm thu *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="VD: Đợt 1 — TKCS cầu Hồng Phong" className={inputCls} />
            </div>
          </div>

          {/* Hàng 2: Giá trị NT + Ngày NT (bắt buộc) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Giá trị được nghiệm thu (VNĐ) *</label>
              <input type="number" min={0} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: +e.target.value })}
                className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>Ngày nghiệm thu *</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={inputCls} />
            </div>
          </div>

          {/* Hàng 3: Thanh toán (tuỳ chọn — có thể cập nhật sau) */}
          <div className="border-t border-border/50 pt-4">
            <p className="text-xs text-muted-foreground mb-3">Thông tin thanh toán <span className="text-muted-foreground/50">(có thể cập nhật sau)</span></p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>GT được thanh toán (VNĐ)</label>
                <input type="number" min={0} value={form.payable_amount || ""} onChange={(e) => setForm({ ...form, payable_amount: +e.target.value })}
                  className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className={labelCls}>GT đã thanh toán (VNĐ)</label>
                <input type="number" min={0} value={form.paid_amount || ""} onChange={(e) => setForm({ ...form, paid_amount: +e.target.value })}
                  className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className={labelCls}>Ngày thanh toán</label>
                <input type="date" value={form.paid_date} onChange={(e) => setForm({ ...form, paid_date: e.target.value })} className={inputCls} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={onCreate.isPending}>
            {onCreate.isPending ? "Đang tạo..." : "Tạo nghiệm thu"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Dòng chỉnh sửa thanh toán inline ──────────────────────────── */

function EditPaymentRow({ milestone, onSave, onCancel }: {
  milestone: any;
  onSave: ReturnType<typeof useUpdateBillingMilestone>;
  onCancel: () => void;
}) {
  const [payable, setPayable] = useState(Number(milestone.payable_amount) || 0);
  const [paid, setPaid] = useState(Number(milestone.paid_amount) || 0);
  const [paidDate, setPaidDate] = useState(milestone.paid_date || "");

  const handleSave = () => {
    const updates: { id: string; [k: string]: any } = {
      id: milestone.id,
      payable_amount: payable,
      paid_amount: paid,
    };
    if (paidDate) updates.paid_date = paidDate;
    // Cập nhật status dựa trên giá trị thanh toán
    if (paid > 0 && paid >= payable) updates.status = "paid";
    else if (payable > 0 || Number(milestone.amount) > 0) updates.status = "invoiced";

    onSave.mutate(updates as any, {
      onSuccess: () => { toast.success("Cập nhật thanh toán thành công"); onCancel(); },
      onError: (e) => toast.error(e.message),
    });
  };

  const inputCls = "w-28 h-7 px-2 rounded border border-border bg-secondary text-xs font-mono focus:border-primary focus:outline-none";

  return (
    <tr className="bg-primary/5">
      <td className="px-4 py-2 font-medium">{milestone.title}</td>
      <td className="px-4 py-2 text-muted-foreground font-mono text-[11px]">{milestone.contract?.contract_no}</td>
      <td className="px-4 py-2 font-mono font-semibold text-blue-500">{formatVND(Number(milestone.amount))}</td>
      <td className="px-4 py-2 text-muted-foreground">{formatDate(milestone.due_date)}</td>
      <td className="px-4 py-2"><input type="number" min={0} value={payable || ""} onChange={(e) => setPayable(+e.target.value)} className={inputCls} /></td>
      <td className="px-4 py-2"><input type="number" min={0} value={paid || ""} onChange={(e) => setPaid(+e.target.value)} className={inputCls} /></td>
      <td className="px-4 py-2"><input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className={`${inputCls} w-32`} /></td>
      <td className="px-4 py-2" />
      <td className="px-4 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="primary" onClick={handleSave} disabled={onSave.isPending}>Lưu</Button>
          <Button size="sm" onClick={onCancel}>Hủy</Button>
        </div>
      </td>
    </tr>
  );
}
