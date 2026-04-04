import type { UserRole, GoalType } from "@/lib/types";

// admin=6, leader=5, director=4, head=3, team_leader=2, staff=1
const ROLE_HIERARCHY: Record<UserRole, number> = { admin: 6, leader: 5, director: 4, head: 3, team_leader: 2, staff: 1 };

export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

export function canCreateProject(role: UserRole): boolean {
  return hasMinRole(role, "director"); // level 4+
}

export function getAllowedGoalTypes(role: UserRole): GoalType[] {
  if (hasMinRole(role, "leader")) return ["company", "center", "department", "team", "personal"];
  if (role === "head") return ["department", "team", "personal"];
  if (role === "team_leader") return ["team", "personal"];
  return ["personal"];
}
