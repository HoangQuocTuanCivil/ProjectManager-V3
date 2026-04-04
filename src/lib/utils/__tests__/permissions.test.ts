import { describe, it, expect } from 'vitest';
import { hasMinRole, canCreateProject, getAllowedGoalTypes } from '../permissions';
import type { UserRole } from '@/lib/types';

const ROLES_ASC: UserRole[] = ['staff', 'team_leader', 'head', 'director', 'leader', 'admin'];

describe('hasMinRole', () => {
  it('trả về true khi role >= minRole', () => {
    expect(hasMinRole('admin', 'staff')).toBe(true);
    expect(hasMinRole('leader', 'director')).toBe(true);
    expect(hasMinRole('head', 'head')).toBe(true);
  });

  it('trả về false khi role < minRole', () => {
    expect(hasMinRole('staff', 'admin')).toBe(false);
    expect(hasMinRole('team_leader', 'head')).toBe(false);
    expect(hasMinRole('head', 'director')).toBe(false);
  });

  it('mỗi role luôn đủ quyền so với chính nó', () => {
    ROLES_ASC.forEach((role) => {
      expect(hasMinRole(role, role)).toBe(true);
    });
  });
});

describe('canCreateProject', () => {
  it('cho phép director trở lên tạo project', () => {
    expect(canCreateProject('director')).toBe(true);
    expect(canCreateProject('leader')).toBe(true);
    expect(canCreateProject('admin')).toBe(true);
  });

  it('không cho phép dưới director tạo project', () => {
    expect(canCreateProject('head')).toBe(false);
    expect(canCreateProject('team_leader')).toBe(false);
    expect(canCreateProject('staff')).toBe(false);
  });
});

describe('getAllowedGoalTypes', () => {
  it('leader/admin: trả về tất cả goal types', () => {
    const all = ['company', 'center', 'department', 'team', 'personal'];
    expect(getAllowedGoalTypes('leader')).toEqual(all);
    expect(getAllowedGoalTypes('admin')).toEqual(all);
  });

  it('head: department, team, personal', () => {
    expect(getAllowedGoalTypes('head')).toEqual(['department', 'team', 'personal']);
  });

  it('team_leader: team, personal', () => {
    expect(getAllowedGoalTypes('team_leader')).toEqual(['team', 'personal']);
  });

  it('staff: chỉ personal', () => {
    expect(getAllowedGoalTypes('staff')).toEqual(['personal']);
  });

  it('director: chỉ personal (level 4 < leader level 5, không match head/team_leader)', () => {
    expect(getAllowedGoalTypes('director')).toEqual(['personal']);
  });
});
