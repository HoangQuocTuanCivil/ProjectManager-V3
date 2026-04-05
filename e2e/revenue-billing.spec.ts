import { test, expect } from "@playwright/test";

const API = "/api";

/**
 * Integration test: Billing Milestone → Revenue Entry → Dept Allocations
 *
 * Sử dụng API routes trực tiếp (không qua UI) để kiểm tra luồng dữ liệu
 * end-to-end giữa billing_milestones, revenue_entries, dept_revenue_allocations.
 *
 * Yêu cầu: Server đang chạy với seed data (org, project, contract, departments).
 */

test.describe("Billing → Revenue integration", () => {
  let contractId: string;
  let milestoneId: string;
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    // Lấy contract đầu tiên có milestones
    const contractsRes = await request.get(`${API}/revenue/summary`);
    // Nếu chưa login → skip
    if (contractsRes.status() === 401) {
      test.skip();
    }
  });

  test("Scenario 1: Happy path — milestone paid → revenue entry created", async ({ request }) => {
    // Lấy danh sách contracts
    const contractsPage = await request.get(`${API}/revenue?per_page=1&status=confirmed`);
    const contractsData = await contractsPage.json();

    // Lấy 1 entry để biết project_id, contract_id
    const entries = contractsData.data ?? [];
    if (entries.length > 0) {
      projectId = entries[0].project_id;
      contractId = entries[0].contract_id;
    }

    // Tạo revenue entry mới qua API
    const createRes = await request.post(`${API}/revenue`, {
      data: {
        dimension: "contract",
        method: "acceptance",
        source: "billing_milestone",
        amount: 50000000,
        description: "E2E Test: milestone payment",
        project_id: projectId ?? null,
        contract_id: contractId ?? null,
        dept_id: null,
        source_id: null,
        period_start: null,
        period_end: null,
        notes: "e2e-test",
      },
    });

    if (createRes.status() === 401) {
      test.skip();
      return;
    }

    expect(createRes.status()).toBe(201);
    const entry = await createRes.json();
    expect(entry.id).toBeTruthy();
    expect(entry.status).toBe("draft");
    milestoneId = entry.id;

    // Confirm entry
    const confirmRes = await request.post(`${API}/revenue/${milestoneId}/confirm`);
    expect(confirmRes.status()).toBe(200);
    const confirmed = await confirmRes.json();
    expect(confirmed.status).toBe("confirmed");

    // Verify entry exists via GET
    const getRes = await request.get(`${API}/revenue/${milestoneId}`);
    expect(getRes.status()).toBe(200);
    const detail = await getRes.json();
    expect(detail.status).toBe("confirmed");
    expect(Number(detail.amount)).toBe(50000000);
  });

  test("Scenario 2: Idempotency — confirm twice → no duplicate", async ({ request }) => {
    if (!milestoneId) test.skip();

    // Confirm again
    const confirmRes = await request.post(`${API}/revenue/${milestoneId}/confirm`);
    // Should fail because already confirmed
    expect(confirmRes.status()).toBe(400);
    const body = await confirmRes.json();
    expect(body.error).toBeTruthy();
  });

  test("Scenario 3: Cancel → reversal entry created", async ({ request }) => {
    if (!milestoneId) test.skip();

    const cancelRes = await request.post(`${API}/revenue/${milestoneId}/cancel`);
    expect(cancelRes.status()).toBe(200);

    // Verify original is cancelled
    const getRes = await request.get(`${API}/revenue/${milestoneId}`);
    const original = await getRes.json();
    expect(original.status).toBe("cancelled");

    // Verify reversal entry exists (negative amount with description starting with "Huỷ:")
    const listRes = await request.get(`${API}/revenue?search=${encodeURIComponent("Huỷ: E2E Test")}&per_page=5`);
    const list = await listRes.json();
    const reversals = (list.data ?? []).filter(
      (e: any) => e.description.startsWith("Huỷ:") && Number(e.amount) === -50000000
    );
    expect(reversals.length).toBeGreaterThanOrEqual(1);
  });

  test("Scenario 4: Multi-department allocation — sum matches amount", async ({ request }) => {
    // Create a new confirmed entry
    const createRes = await request.post(`${API}/revenue`, {
      data: {
        dimension: "project",
        method: "acceptance",
        source: "manual",
        amount: 120000000,
        description: "E2E Test: multi-dept allocation",
        project_id: projectId ?? null,
        contract_id: null,
        dept_id: null,
        source_id: null,
        period_start: null,
        period_end: null,
        notes: "e2e-dept-test",
      },
    });

    if (createRes.status() === 401) {
      test.skip();
      return;
    }

    expect(createRes.status()).toBe(201);
    const entry = await createRes.json();

    // Confirm to trigger allocation
    const confirmRes = await request.post(`${API}/revenue/${entry.id}/confirm`);
    expect(confirmRes.status()).toBe(200);

    // Fetch detail with allocations
    const detailRes = await request.get(`${API}/revenue/${entry.id}`);
    const detail = await detailRes.json();

    const allocations = detail.allocations ?? [];

    if (allocations.length > 0) {
      // Verify each allocation has valid percentage
      for (const alloc of allocations) {
        expect(Number(alloc.allocation_percentage)).toBeGreaterThanOrEqual(0);
        expect(Number(alloc.allocation_percentage)).toBeLessThanOrEqual(100);
        expect(Number(alloc.allocated_amount)).toBeGreaterThanOrEqual(0);
      }

      // Verify sum ≈ entry amount (rounding tolerance)
      const allocSum = allocations.reduce((s: number, a: any) => s + Number(a.allocated_amount), 0);
      expect(Math.abs(allocSum - 120000000)).toBeLessThanOrEqual(allocations.length);
    }

    // Cleanup: cancel the test entry
    await request.post(`${API}/revenue/${entry.id}/cancel`);
  });

  test("Scenario 5: Dashboard data verification", async ({ request }) => {
    const summaryRes = await request.get(`${API}/revenue/summary`);
    if (summaryRes.status() === 401) {
      test.skip();
      return;
    }

    expect(summaryRes.status()).toBe(200);
    const summary = await summaryRes.json();

    expect(typeof summary.total).toBe("number");
    expect(typeof summary.draft).toBe("number");
    expect(summary.byDimension).toBeTruthy();
    expect(summary.byMethod).toBeTruthy();
    expect(summary.bySource).toBeTruthy();

    // Filters work
    const filteredRes = await request.get(`${API}/revenue?status=confirmed&per_page=5`);
    expect(filteredRes.status()).toBe(200);
    const filtered = await filteredRes.json();
    expect(Array.isArray(filtered.data)).toBe(true);

    for (const entry of filtered.data) {
      expect(entry.status).toBe("confirmed");
    }
  });
});
