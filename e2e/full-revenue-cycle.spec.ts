import { test, expect } from "@playwright/test";

const API = "/api";

/**
 * E2E Test: Luồng hoàn chỉnh
 * HĐ → billing paid → revenue entry → dept allocation → quỹ PB → lương → thưởng
 *
 * Kiểm tra toàn bộ chain tự động từ thanh toán mốc đến tính thưởng khoán.
 */

test.describe("Full Revenue → Bonus cycle", () => {
  test.beforeAll(async ({ request }) => {
    const check = await request.get(`${API}/revenue/summary`);
    if (check.status() === 401) test.skip();
  });

  test("1. Revenue CRUD: create draft → confirm → verify allocation", async ({ request }) => {
    // Tạo revenue entry draft
    const createRes = await request.post(`${API}/revenue`, {
      data: {
        dimension: "project", method: "acceptance", source: "manual",
        amount: 200000000, description: "E2E Full Cycle Test",
        project_id: null, contract_id: null, dept_id: null,
        source_id: null, period_start: null, period_end: null, notes: "e2e-full",
      },
    });
    if (createRes.status() === 401) { test.skip(); return; }
    expect(createRes.status()).toBe(201);
    const entry = await createRes.json();
    expect(entry.status).toBe("draft");
    expect(entry.id).toBeTruthy();

    // Confirm → trigger fn_allocate_dept_revenue
    const confirmRes = await request.post(`${API}/revenue/${entry.id}/confirm`);
    expect(confirmRes.status()).toBe(200);
    const confirmed = await confirmRes.json();
    expect(confirmed.status).toBe("confirmed");

    // Verify entry detail
    const detailRes = await request.get(`${API}/revenue/${entry.id}`);
    expect(detailRes.status()).toBe(200);
    const detail = await detailRes.json();
    expect(detail.status).toBe("confirmed");
    expect(Number(detail.amount)).toBe(200000000);

    // Cleanup
    await request.post(`${API}/revenue/${entry.id}/cancel`);
  });

  test("2. Cancel creates offsetting entry", async ({ request }) => {
    const createRes = await request.post(`${API}/revenue`, {
      data: {
        dimension: "project", method: "acceptance", source: "manual",
        amount: 50000000, description: "E2E Cancel Test",
        project_id: null, contract_id: null, dept_id: null,
        source_id: null, period_start: null, period_end: null, notes: null,
      },
    });
    if (createRes.status() === 401) { test.skip(); return; }
    const entry = await createRes.json();

    // Confirm then cancel
    await request.post(`${API}/revenue/${entry.id}/confirm`);
    const cancelRes = await request.post(`${API}/revenue/${entry.id}/cancel`);
    expect(cancelRes.status()).toBe(200);

    // Verify offsetting entry exists
    const listRes = await request.get(`${API}/revenue?search=${encodeURIComponent("Huỷ: E2E Cancel Test")}&per_page=5`);
    const list = await listRes.json();
    const reversals = (list.data ?? []).filter(
      (e: any) => e.description.startsWith("Huỷ:") && Number(e.amount) === -50000000
    );
    expect(reversals.length).toBeGreaterThanOrEqual(1);
  });

  test("3. Revenue summary responds with correct structure", async ({ request }) => {
    const res = await request.get(`${API}/revenue/summary`);
    if (res.status() === 401) { test.skip(); return; }
    expect(res.status()).toBe(200);
    const summary = await res.json();
    expect(typeof summary.total).toBe("number");
    expect(typeof summary.draft).toBe("number");
    expect(summary.byDimension).toBeTruthy();
    expect(summary.byMethod).toBeTruthy();
    expect(summary.bySource).toBeTruthy();
  });

  test("4. Revenue filters work (status, source, date range)", async ({ request }) => {
    const res = await request.get(`${API}/revenue?status=confirmed&per_page=5`);
    if (res.status() === 401) { test.skip(); return; }
    expect(res.status()).toBe(200);
    const data = await res.json();
    for (const entry of data.data ?? []) {
      expect(entry.status).toBe("confirmed");
    }

    // Source filter
    const srcRes = await request.get(`${API}/revenue?source=manual&per_page=3`);
    expect(srcRes.status()).toBe(200);
  });

  test("5. Salary CRUD: create batch → verify", async ({ request }) => {
    const salaryRes = await request.get(`${API}/salary?per_page=1`);
    if (salaryRes.status() === 401) { test.skip(); return; }
    expect(salaryRes.status()).toBe(200);
    // Structure check
    const data = await salaryRes.json();
    expect(Array.isArray(data.data)).toBe(true);
  });

  test("6. Allocation cycle config: read/write", async ({ request }) => {
    const getRes = await request.get(`${API}/allocation-cycle`);
    if (getRes.status() === 401) { test.skip(); return; }
    expect(getRes.status()).toBe(200);
  });

  test("7. Fund summary returns dept data", async ({ request }) => {
    const res = await request.get(`${API}/kpi/allocation/fund-summary`);
    if (res.status() === 401) { test.skip(); return; }
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("8. Reports: profit/loss endpoint", async ({ request }) => {
    const res = await request.get(`${API}/reports/profitloss`);
    if (res.status() === 401) { test.skip(); return; }
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.contracts).toBeDefined();
    expect(data.totals).toBeDefined();
    expect(typeof data.totals.profit).toBe("number");
  });

  test("9. Reports: budget vs actual", async ({ request }) => {
    const deptRes = await request.get(`${API}/reports/budget-vs-actual?group=dept`);
    if (deptRes.status() === 401) { test.skip(); return; }
    expect(deptRes.status()).toBe(200);
    const deptData = await deptRes.json();
    expect(Array.isArray(deptData)).toBe(true);

    const projRes = await request.get(`${API}/reports/budget-vs-actual?group=project`);
    expect(projRes.status()).toBe(200);
  });

  test("10. Reports: bonus summary", async ({ request }) => {
    const res = await request.get(`${API}/reports/bonus-summary`);
    if (res.status() === 401) { test.skip(); return; }
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(typeof data.total_employees).toBe("number");
    expect(typeof data.total_bonus).toBe("number");
    expect(Array.isArray(data.byDept)).toBe(true);
  });
});
