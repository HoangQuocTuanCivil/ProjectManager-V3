import { describe, it, expect } from 'vitest';
import { requireMinRole, parsePagination, jsonResponse, errorResponse } from '../helpers';

// ─── jsonResponse ──────────────────────────────────────────
describe('jsonResponse', () => {
  it('trả về JSON với status mặc định 200', () => {
    const res = jsonResponse({ ok: true });
    expect(res.status).toBe(200);
  });

  it('cho phép tuỳ chỉnh status code', () => {
    const res = jsonResponse({ id: '1' }, 201);
    expect(res.status).toBe(201);
  });
});

// ─── errorResponse ─────────────────────────────────────────
describe('errorResponse', () => {
  it('trả về JSON error với status mặc định 400', async () => {
    const res = errorResponse('Bad input');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Bad input');
  });

  it('cho phép tuỳ chỉnh status code', () => {
    const res = errorResponse('Not found', 404);
    expect(res.status).toBe(404);
  });
});

// ─── requireMinRole ────────────────────────────────────────
describe('requireMinRole', () => {
  it('trả về null khi đủ quyền', () => {
    expect(requireMinRole({ role: 'admin' }, 'director')).toBeNull();
    expect(requireMinRole({ role: 'leader' }, 'leader')).toBeNull();
  });

  it('trả về error string khi không đủ quyền', () => {
    expect(requireMinRole({ role: 'staff' }, 'head')).toBe('Forbidden: insufficient permissions');
    expect(requireMinRole({ role: 'team_leader' }, 'director')).toBe('Forbidden: insufficient permissions');
  });

  it('trả về "Unauthorized" khi profile = null', () => {
    expect(requireMinRole(null, 'staff')).toBe('Unauthorized');
  });
});

// ─── parsePagination ───────────────────────────────────────
describe('parsePagination', () => {
  function params(obj: Record<string, string> = {}) {
    return new URLSearchParams(obj);
  }

  it('trả về giá trị mặc định page=1, per_page=50', () => {
    const result = parsePagination(params());
    expect(result).toEqual({ page: 1, per_page: 50, from: 0, to: 49 });
  });

  it('tính from/to đúng theo page và per_page', () => {
    const result = parsePagination(params({ page: '3', per_page: '20' }));
    expect(result).toEqual({ page: 3, per_page: 20, from: 40, to: 59 });
  });

  it('giới hạn per_page tối đa 100', () => {
    const result = parsePagination(params({ per_page: '999' }));
    expect(result.per_page).toBe(100);
  });

  it('đảm bảo page >= 1', () => {
    const result = parsePagination(params({ page: '-5' }));
    expect(result.page).toBe(1);
  });

  it('đảm bảo per_page >= 1', () => {
    const result = parsePagination(params({ per_page: '0' }));
    expect(result.per_page).toBe(1);
  });
});
