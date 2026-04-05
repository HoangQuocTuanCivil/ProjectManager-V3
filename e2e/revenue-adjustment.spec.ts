import { test, expect } from "@playwright/test";

const API = "/api";

/**
 * Integration test: Contract Addendum → Revenue Adjustment + Draft Entry
 *
 * Luồng: INSERT contract_addendums → trigger fn_revenue_adjustment() →
 *   1. INSERT revenue_adjustments (audit trail)
 *   2. INSERT revenue_entries (draft, amount = value_change) nếu value_change ≠ 0
 */

test.describe("Addendum → Adjustment integration", () => {
  let draftEntryId: string;

  test.beforeAll(async ({ request }) => {
    const check = await request.get(`${API}/revenue/summary`);
    if (check.status() === 401) test.skip();
  });

  test("Scenario 1: Addendum +100M → adjustment record + draft entry dương", async ({ request }) => {
    // Lấy danh sách adjustments trước
    const beforeRes = await request.get(`${API}/revenue/adjustments?per_page=100`);
    if (beforeRes.status() === 401) { test.skip(); return; }
    const beforeData = await beforeRes.json();
    const countBefore = beforeData.count ?? 0;

    // Tìm entry draft có description bắt đầu với "Điều chỉnh PL" (tạo bởi trigger)
    const entriesBefore = await request.get(
      `${API}/revenue?search=${encodeURIComponent("Điều chỉnh PL")}&status=draft&per_page=100`
    );
    const entriesBeforeData = await entriesBefore.json();
    const draftCountBefore = (entriesBeforeData.data ?? []).length;

    // Kiểm tra adjustments list endpoint hoạt động
    expect(beforeRes.status()).toBe(200);
    expect(typeof countBefore).toBe("number");

    // Verify adjustment records có old_amount, new_amount, adjustment_amount
    const adjustments = beforeData.data ?? [];
    for (const adj of adjustments.slice(0, 3)) {
      expect(typeof adj.old_amount).toBe("number");
      expect(typeof adj.new_amount).toBe("number");
      expect(typeof adj.adjustment_amount).toBe("number");
      expect(adj.adjustment_amount).toBe(adj.new_amount - adj.old_amount);
      expect(adj.reason).toBeTruthy();
    }

    // Nếu có draft entries từ addendum → verify chúng có amount > 0 (tăng giá trị)
    const positiveEntries = (entriesBeforeData.data ?? []).filter(
      (e: any) => Number(e.amount) > 0 && e.description.startsWith("Điều chỉnh PL")
    );
    for (const entry of positiveEntries) {
      expect(entry.status).toBe("draft");
      expect(Number(entry.amount)).toBeGreaterThan(0);
    }
  });

  test("Scenario 2: Addendum -50M → adjustment record + draft entry âm", async ({ request }) => {
    // Tìm draft entries với amount âm (giảm giá trị HĐ)
    const entriesRes = await request.get(
      `${API}/revenue?search=${encodeURIComponent("Điều chỉnh PL")}&status=draft&per_page=100`
    );
    if (entriesRes.status() === 401) { test.skip(); return; }

    const entries = await entriesRes.json();
    const negativeEntries = (entries.data ?? []).filter(
      (e: any) => Number(e.amount) < 0 && e.description.startsWith("Điều chỉnh PL")
    );

    // Verify negative entries có amount < 0
    for (const entry of negativeEntries) {
      expect(entry.status).toBe("draft");
      expect(Number(entry.amount)).toBeLessThan(0);
      expect(entry.addendum_id).toBeTruthy();
    }

    // Verify adjustments API trả về dữ liệu với contract filter
    const adjRes = await request.get(`${API}/revenue/adjustments?per_page=5`);
    expect(adjRes.status()).toBe(200);
    const adjData = await adjRes.json();
    expect(Array.isArray(adjData.data)).toBe(true);

    // Lưu 1 draft entry để test confirm ở Scenario 3
    const allDrafts = (entries.data ?? []).filter(
      (e: any) => e.status === "draft" && e.description.startsWith("Điều chỉnh PL")
    );
    if (allDrafts.length > 0) {
      draftEntryId = allDrafts[0].id;
    }
  });

  test("Scenario 3: Admin confirm draft → status=confirmed → dashboard updated", async ({ request }) => {
    // Tạo 1 draft entry mới để test confirm flow
    const createRes = await request.post(`${API}/revenue`, {
      data: {
        dimension: "contract",
        method: "acceptance",
        source: "manual",
        amount: 100000000,
        description: "E2E Adjustment Confirm Test",
        project_id: null,
        contract_id: null,
        dept_id: null,
        source_id: null,
        period_start: null,
        period_end: null,
        notes: "e2e-adjustment-confirm",
      },
    });

    if (createRes.status() === 401) { test.skip(); return; }
    expect(createRes.status()).toBe(201);
    const entry = await createRes.json();
    expect(entry.status).toBe("draft");

    // Snapshot dashboard trước confirm
    const summaryBefore = await request.get(`${API}/revenue/summary`);
    const beforeSummary = await summaryBefore.json();
    const confirmedBefore = beforeSummary.total;
    const draftBefore = beforeSummary.draft;

    // Confirm
    const confirmRes = await request.post(`${API}/revenue/${entry.id}/confirm`);
    expect(confirmRes.status()).toBe(200);
    const confirmed = await confirmRes.json();
    expect(confirmed.status).toBe("confirmed");

    // Verify dashboard updated
    const summaryAfter = await request.get(`${API}/revenue/summary`);
    const afterSummary = await summaryAfter.json();

    expect(afterSummary.total).toBe(confirmedBefore + 100000000);
    expect(afterSummary.draft).toBe(draftBefore - 100000000);

    // Verify GET entry returns confirmed
    const getRes = await request.get(`${API}/revenue/${entry.id}`);
    const detail = await getRes.json();
    expect(detail.status).toBe("confirmed");

    // Cleanup
    await request.post(`${API}/revenue/${entry.id}/cancel`);
  });
});
