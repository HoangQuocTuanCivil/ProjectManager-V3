"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores";
import { UserAvatar, Button } from "@/components/shared";
import { ROLE_CONFIG, formatRelativeDate } from "@/lib/utils/kpi";
import { toast } from "sonner";
import { Send, AtSign, Slash } from "lucide-react";

const supabase = createClient();

interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: { id: string; full_name: string; role: string; avatar_url?: string | null };
}


function useTaskComments(taskId: string) {
  return useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*, user:users!task_comments_user_id_fkey(id, full_name, role, avatar_url)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Comment[];
    },
    refetchInterval: 10_000,
  });
}

function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, userId, content }: { taskId: string; userId: string; content: string }) => {
      const { error } = await supabase.from("task_comments").insert({
        task_id: taskId,
        user_id: userId,
        content,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["task-comments", vars.taskId] });
    },
  });
}

function useSearchTasks(query: string) {
  return useQuery({
    queryKey: ["task-search-mention", query],
    queryFn: async () => {
      if (!query || query.length < 1) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, code")
        .or(`title.ilike.%${query}%,code.ilike.%${query}%`)
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    enabled: query.length >= 1,
  });
}

// Fetch all users involved in a project (assignees, assigners, heads, directors, team leaders)
function useProjectMembers(projectId?: string | null) {
  return useQuery({
    queryKey: ["project-mention-members", projectId],
    queryFn: async () => {
      if (!projectId) return [];
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

      // Add dept heads + center directors
      if (deptIds.size > 0) {
        const { data: depts } = await supabase.from("departments").select("head_user_id, center_id").in("id", Array.from(deptIds));
        if (depts) {
          depts.forEach((d: any) => { if (d.head_user_id) userIds.add(d.head_user_id); });
          const centerIds = [...new Set(depts.map((d: any) => d.center_id).filter(Boolean))];
          if (centerIds.length > 0) {
            const { data: centers } = await supabase.from("centers").select("director_id").in("id", centerIds);
            if (centers) centers.forEach((c: any) => { if (c.director_id) userIds.add(c.director_id); });
          }
        }
      }
      // Add team leaders
      if (teamIds.size > 0) {
        const { data: teams } = await supabase.from("teams").select("leader_id").in("id", Array.from(teamIds));
        if (teams) teams.forEach((t: any) => { if (t.leader_id) userIds.add(t.leader_id); });
      }

      if (userIds.size === 0) return [];
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name, email, role, avatar_url")
        .in("id", Array.from(userIds))
        .eq("is_active", true)
        .order("full_name");
      return users || [];
    },
    enabled: !!projectId,
  });
}


export function TaskMessenger({ taskId, projectId }: { taskId: string; projectId?: string | null }) {
  const { user } = useAuthStore();
  const { data: comments = [], isLoading } = useTaskComments(taskId);
  const { data: projectMembers = [] } = useProjectMembers(projectId);
  const addComment = useAddComment();

  const [text, setText] = useState("");
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [showTaskPopup, setShowTaskPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [taskQuery, setTaskQuery] = useState("");
  const { data: searchedTasks = [] } = useSearchTasks(taskQuery);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments.length]);

  // Filter project members for @mention
  const filteredUsers = projectMembers
    .filter((u: any) => u.id !== user?.id)
    .filter((u: any) =>
      !mentionQuery || u.full_name?.toLowerCase().includes(mentionQuery.toLowerCase())
    )
    .slice(0, 10);

  // Parse input for @ and / triggers
  const handleInput = useCallback((val: string) => {
    setText(val);
    const cursorPos = textareaRef.current?.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursorPos);

    // Check for @mention trigger
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setShowMentionPopup(true);
      setShowTaskPopup(false);
      return;
    }
    setShowMentionPopup(false);

    // Check for /task trigger
    const slashMatch = textBeforeCursor.match(/\/(\S*)$/);
    if (slashMatch) {
      setTaskQuery(slashMatch[1]);
      setShowTaskPopup(true);
      setShowMentionPopup(false);
      return;
    }
    setShowTaskPopup(false);
  }, []);

  // Insert @mention
  const insertMention = (userName: string) => {
    const cursorPos = textareaRef.current?.selectionStart ?? text.length;
    const textBefore = text.slice(0, cursorPos);
    const textAfter = text.slice(cursorPos);
    const newBefore = textBefore.replace(/@(\w*)$/, `@${userName} `);
    setText(newBefore + textAfter);
    setShowMentionPopup(false);
    setMentionQuery("");
    textareaRef.current?.focus();
  };

  // Insert /task reference
  const insertTaskRef = (taskCode: string, taskTitle: string) => {
    const cursorPos = textareaRef.current?.selectionStart ?? text.length;
    const textBefore = text.slice(0, cursorPos);
    const textAfter = text.slice(cursorPos);
    const newBefore = textBefore.replace(/\/(\S*)$/, `[${taskCode}: ${taskTitle}] `);
    setText(newBefore + textAfter);
    setShowTaskPopup(false);
    setTaskQuery("");
    textareaRef.current?.focus();
  };

  // Send message + notify mentioned users
  const handleSend = async () => {
    const content = text.trim();
    if (!content || !user) return;
    try {
      await addComment.mutateAsync({ taskId, userId: user.id, content });
      setText("");
      setShowMentionPopup(false);
      setShowTaskPopup(false);

      // Parse @mentions and send notifications
      const mentionMatches = content.match(/@(\S+)/g);
      if (mentionMatches && mentionMatches.length > 0) {
        const mentionedNames = mentionMatches.map((m) => m.slice(1).replace(/_/g, " ").toLowerCase());
        const mentionedUsers = projectMembers.filter((u: any) =>
          u.id !== user.id && mentionedNames.includes(u.full_name?.toLowerCase())
        );
        if (mentionedUsers.length > 0) {
          const excerpt = content.length > 100 ? content.slice(0, 100) + "..." : content;
          await supabase.from("notifications").insert(
            mentionedUsers.map((mu: any) => ({
              org_id: user.org_id,
              user_id: mu.id,
              title: `${user.full_name} đã nhắc đến bạn`,
              body: excerpt,
              type: "mention",
              data: { task_id: taskId },
            }))
          );
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi gửi tin nhắn");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      setShowMentionPopup(false);
      setShowTaskPopup(false);
    }
  };

  // Render content with @mentions highlighted
  const renderContent = (content: string) => {
    // Highlight @mentions and [TASK_CODE: title] references
    const parts = content.split(/(@\S+|\[[^\]]+\])/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return <span key={i} className="text-primary font-semibold bg-primary/10 rounded px-0.5">{part}</span>;
      }
      if (part.startsWith("[") && part.endsWith("]")) {
        return <span key={i} className="text-blue-600 dark:text-blue-400 font-medium bg-blue-500/10 rounded px-0.5 cursor-pointer hover:underline">{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden flex flex-col" style={{ maxHeight: 420 }}>
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border bg-secondary/30 flex items-center justify-between">
        <h4 className="text-sm font-bold flex items-center gap-1.5">
          💬 Trao đổi
          <span className="text-muted-foreground font-normal">({comments.length})</span>
        </h4>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5"><AtSign size={12} /> @tag người</span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-0.5"><Slash size={12} /> /tag task</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[120px] max-h-[260px]">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Đang tải...</p>
        ) : comments.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">Chưa có tin nhắn nào</p>
            <p className="text-xs text-muted-foreground mt-1">Hãy gõ tin nhắn bên dưới để bắt đầu trao đổi</p>
          </div>
        ) : (
          comments.map((c) => {
            const isMe = c.user_id === user?.id;
            return (
              <div key={c.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                {c.user && (
                  <UserAvatar
                    name={c.user.full_name}
                    color={(ROLE_CONFIG as any)[c.user.role]?.color}
                    size="xs"
                    src={c.user.avatar_url}
                  />
                )}
                <div className={`max-w-[80%] ${isMe ? "text-right" : ""}`}>
                  <div className={`flex items-center gap-1.5 ${isMe ? "justify-end" : ""}`}>
                    <span className="text-xs font-semibold">{c.user?.full_name}</span>
                    <span className="text-[10px] text-muted-foreground">{formatRelativeDate(c.created_at)}</span>
                  </div>
                  <div
                    className={`mt-0.5 px-3 py-1.5 rounded-xl text-sm leading-relaxed ${
                      isMe
                        ? "rounded-tr-sm text-gray-900"
                        : "bg-secondary text-foreground rounded-tl-sm"
                    }`}
                    style={isMe ? { background: "#BBC4BB" } : undefined}
                  >
                    {renderContent(c.content)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input area */}
      <div className="relative border-t border-border">
        {/* @Mention popup */}
        {showMentionPopup && filteredUsers.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 bg-card border border-border rounded-t-xl shadow-lg max-h-[200px] overflow-y-auto z-20">
            <div className="px-3 py-1.5 border-b border-border/50 flex items-center gap-1">
              <AtSign size={12} className="text-primary" />
              <span className="text-xs font-semibold text-primary">Tag nhân sự</span>
            </div>
            {filteredUsers.map((u: any) => (
              <button
                key={u.id}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-secondary transition-colors text-left"
                onClick={() => insertMention(u.full_name.replace(/\s+/g, "_"))}
              >
                <UserAvatar name={u.full_name} color={(ROLE_CONFIG as any)[u.role]?.color} size="xs" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                  {(ROLE_CONFIG as any)[u.role]?.label || u.role}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* /Task popup */}
        {showTaskPopup && searchedTasks.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 bg-card border border-border rounded-t-xl shadow-lg max-h-[200px] overflow-y-auto z-20">
            <div className="px-3 py-1.5 border-b border-border/50 flex items-center gap-1">
              <Slash size={12} className="text-blue-500" />
              <span className="text-xs font-semibold text-blue-500">Tag công việc</span>
            </div>
            {searchedTasks.map((t: any) => (
              <button
                key={t.id}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-secondary transition-colors text-left"
                onClick={() => insertTaskRef(t.code || t.id.slice(0, 8), t.title)}
              >
                <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">{t.code || t.id.slice(0, 8)}</span>
                <span className="text-sm truncate flex-1">{t.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex items-end gap-2 p-3">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhắn tin... (@tag người, /tag task)"
            rows={1}
            className="flex-1 resize-none text-sm px-3 py-2 rounded-lg border border-border bg-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[36px] max-h-[80px]"
            style={{ height: "auto", overflow: "hidden" }}
            onInput={(e: any) => {
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
            }}
          />
          <button
            onClick={handleSend}
            disabled={addComment.isPending || !text.trim()}
            className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            aria-label="Gửi"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
