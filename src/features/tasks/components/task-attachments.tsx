"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores";
import { Button } from "@/components/shared";
import { toast } from "sonner";
import { Paperclip, Download, Trash2, FileText, Image, Film, FileArchive, File } from "lucide-react";

const supabase = createClient();
const BUCKET = "task-files";

interface Attachment {
  id: string;
  task_id: string;
  uploaded_by: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string | null;
  created_at: string;
  uploader?: { full_name: string };
}


function useTaskAttachments(taskId: string) {
  return useQuery({
    queryKey: ["task-attachments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_attachments")
        .select("*, uploader:users!task_attachments_uploaded_by_fkey(full_name)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Attachment[];
    },
  });
}

function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fileUrl, taskId }: { id: string; fileUrl: string; taskId: string }) => {
      // Delete from storage
      const path = fileUrl.split(`/storage/v1/object/public/${BUCKET}/`)[1];
      if (path) {
        await supabase.storage.from(BUCKET).remove([path]);
      }
      // Delete from DB
      const { error } = await supabase.from("task_attachments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["task-attachments", vars.taskId] });
      toast.success("Đã xóa tập tin");
    },
    onError: (e: any) => toast.error(e.message || "Lỗi xóa tập tin"),
  });
}


function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File size={18} className="text-muted-foreground" />;
  if (mimeType.startsWith("image/")) return <Image size={18} className="text-green-500" />;
  if (mimeType.startsWith("video/")) return <Film size={18} className="text-purple-500" />;
  if (mimeType.includes("pdf")) return <FileText size={18} className="text-red-500" />;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z"))
    return <FileArchive size={18} className="text-amber-500" />;
  if (mimeType.includes("word") || mimeType.includes("document"))
    return <FileText size={18} className="text-blue-500" />;
  if (mimeType.includes("sheet") || mimeType.includes("excel"))
    return <FileText size={18} className="text-green-600" />;
  return <File size={18} className="text-muted-foreground" />;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}


export function TaskAttachments({ taskId }: { taskId: string }) {
  const { user } = useAuthStore();
  const { data: attachments = [], isLoading } = useTaskAttachments(taskId);
  const deleteAttachment = useDeleteAttachment();
  const qc = useQueryClient();

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop() || "bin";
        const storagePath = `${taskId}/${Date.now()}_${file.name}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, file, { cacheControl: "3600", upsert: false });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

        // Insert record
        const { error: insertError } = await supabase.from("task_attachments").insert({
          task_id: taskId,
          uploaded_by: user.id,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          mime_type: file.type || null,
        });

        if (insertError) throw insertError;
      }

      toast.success(`Đã tải lên ${files.length} tập tin`);
      qc.invalidateQueries({ queryKey: ["task-attachments", taskId] });
    } catch (err: any) {
      toast.error(err.message || "Lỗi tải lên tập tin");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const canDelete = (att: Attachment) =>
    user && (att.uploaded_by === user.id || ["admin", "leader", "head"].includes(user.role));

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border bg-secondary/30 flex items-center justify-between">
        <h4 className="text-sm font-bold flex items-center gap-1.5">
          📎 Đính kèm
          <span className="text-muted-foreground font-normal">({attachments.length})</span>
        </h4>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleUpload}
            className="hidden"
            id={`file-upload-${taskId}`}
          />
          <Button
            size="xs"
            variant="primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Paperclip size={14} />
            {isUploading ? "Đang tải..." : "Tải lên"}
          </Button>
        </div>
      </div>

      {/* File List */}
      <div className="max-h-[220px] overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Đang tải...</p>
        ) : attachments.length === 0 ? (
          <div className="text-center py-5">
            <Paperclip size={24} className="mx-auto text-muted-foreground/40 mb-1.5" />
            <p className="text-sm text-muted-foreground">Chưa có tập tin đính kèm</p>
            <p className="text-xs text-muted-foreground mt-0.5">Bấm "Tải lên" để thêm tập tin</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {attachments.map((att) => (
              <div
                key={att.id}
                className={`px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/30 transition-colors group ${
                  att.mime_type?.includes("pdf") ? "cursor-pointer" : ""
                }`}
                onClick={() => {
                  /* Click vào file PDF → mở xem ở tab mới */
                  if (att.mime_type?.includes("pdf")) {
                    window.open(att.file_url, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                {/* Icon */}
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                  {getFileIcon(att.mime_type)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={att.file_name}>
                    {att.file_name}
                    {att.mime_type?.includes("pdf") && (
                      <span className="ml-1.5 text-[10px] text-red-500 font-normal">PDF — nhấn để xem</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{formatFileSize(att.file_size)}</span>
                    <span>•</span>
                    <span>{att.uploader?.full_name}</span>
                    <span>•</span>
                    <span>{formatDate(att.created_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={att.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    title="Tải xuống"
                  >
                    <Download size={14} />
                  </a>
                  {canDelete(att) && (
                    <button
                      onClick={() => {
                        if (confirm(`Xóa "${att.file_name}"?`))
                          deleteAttachment.mutate({ id: att.id, fileUrl: att.file_url, taskId });
                      }}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Xóa"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
