"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Section, UserAvatar } from "@/components/shared";
import { ROLE_CONFIG } from "@/lib/utils/kpi";

const supabase = createClient();

const ROLE_ORDER: Record<string, number> = { admin: 0, director: 1, leader: 1, head: 2, team_leader: 3, staff: 4 };

// Fetch all personnel involved in a project through task assignments
function useProjectTaskMembers(projectId: string) {
  return useQuery({
    queryKey: ["project-task-members", projectId],
    queryFn: async () => {
      // Get all tasks in this project
      const { data: tasks } = await supabase
        .from("tasks")
        .select("assignee_id, assigner_id, dept_id, team_id")
        .eq("project_id", projectId)
        .neq("status", "cancelled");

      if (!tasks || tasks.length === 0) return [];

      const userIds = new Set<string>();
      const deptIds = new Set<string>();
      const teamIds = new Set<string>();

      tasks.forEach((t: any) => {
        if (t.assignee_id) userIds.add(t.assignee_id);
        if (t.assigner_id) userIds.add(t.assigner_id);
        if (t.dept_id) deptIds.add(t.dept_id);
        if (t.team_id) teamIds.add(t.team_id);
      });

      // Get department heads + center directors
      if (deptIds.size > 0) {
        const { data: depts } = await supabase
          .from("departments")
          .select("head_user_id, center_id")
          .in("id", Array.from(deptIds));
        if (depts) {
          depts.forEach((d: any) => { if (d.head_user_id) userIds.add(d.head_user_id); });
          const centerIds = [...new Set(depts.map((d: any) => d.center_id).filter(Boolean))];
          if (centerIds.length > 0) {
            const { data: centers } = await supabase
              .from("centers")
              .select("director_id")
              .in("id", centerIds);
            if (centers) centers.forEach((c: any) => { if (c.director_id) userIds.add(c.director_id); });
          }
        }
      }

      // Get team leaders
      if (teamIds.size > 0) {
        const { data: teams } = await supabase
          .from("teams")
          .select("leader_id")
          .in("id", Array.from(teamIds));
        if (teams) teams.forEach((t: any) => { if (t.leader_id) userIds.add(t.leader_id); });
      }

      if (userIds.size === 0) return [];

      const { data: users } = await supabase
        .from("users")
        .select("id, full_name, email, role, avatar_url, job_title")
        .in("id", Array.from(userIds))
        .eq("is_active", true)
        .order("full_name");

      return users || [];
    },
    enabled: !!projectId,
  });
}

export default function ProjectMembersPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { data: members = [], isLoading } = useProjectTaskMembers(projectId);

  const sorted = [...members].sort((a: any, b: any) =>
    (ROLE_ORDER[a.role] ?? 5) - (ROLE_ORDER[b.role] ?? 5)
  );

  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold">Thành viên dự án ({sorted.length})</h3>
      <p className="text-sm text-muted-foreground">Tự động hiển thị nhân sự tham gia dự án qua các công việc được giao</p>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-secondary rounded-lg animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">👥</p>
          <p className="text-sm text-muted-foreground">Chưa có thành viên</p>
          <p className="text-xs text-muted-foreground mt-1">Thành viên sẽ tự động xuất hiện khi có công việc được giao trong dự án</p>
        </div>
      ) : (
        <Section title="">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  {["Thành viên", "Email", "Vai trò hệ thống", "Chức danh"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((m: any) => {
                  const roleCfg = (ROLE_CONFIG as any)[m.role] || { label: m.role, color: "#94a3b8" };
                  return (
                    <tr key={m.id} className="border-b border-border/40 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar name={m.full_name} color={roleCfg.color} size="sm" src={m.avatar_url} />
                          <p className="text-base font-semibold">{m.full_name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground">{m.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: `${roleCfg.color}18`, color: roleCfg.color }}>
                          {roleCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground">{m.job_title || "—"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}
