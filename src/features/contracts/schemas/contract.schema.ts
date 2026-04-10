import { z } from "zod";

/* ── Enums ────────────────────────────────────────────────────── */

const contractType = z.enum(["outgoing", "incoming"]);
const contractStatus = z.enum(["draft", "active", "completed", "terminated", "paused", "settled"]);

/* ── Create ───────────────────────────────────────────────────── */

export const createContractSchema = z.object({
  project_id: z.string().uuid("Dự án không hợp lệ"),
  contract_type: contractType.default("outgoing"),
  contract_no: z.string().min(1, "Số hợp đồng không được để trống").max(100),
  title: z.string().min(1, "Tên hợp đồng không được để trống").max(500),
  client_name: z.string().max(255).nullish(),
  bid_package: z.string().max(255).nullish(),
  contract_value: z.number().min(0, "Giá trị hợp đồng phải >= 0"),
  vat_value: z.number().min(0).default(0),
  signed_date: z.string().nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  guarantee_value: z.number().min(0).default(0),
  guarantee_expiry: z.string().nullish(),
  status: contractStatus.default("draft"),
  file_url: z.string().url().nullish().or(z.literal("")),
  notes: z.string().max(2000).nullish(),
  subcontractor_name: z.string().max(255).nullish(),
  work_content: z.string().max(2000).nullish(),
  person_in_charge: z.string().max(255).nullish(),
  contract_scope: z.string().max(500).default(""),
  product_service_id: z.string().uuid().nullish(),
  parent_contract_id: z.string().uuid().nullish(),
});

/* ── Update ───────────────────────────────────────────────────── */

export const updateContractSchema = createContractSchema.partial().extend({
  id: z.string().uuid(),
});

/* ── Types ────────────────────────────────────────────────────── */

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
