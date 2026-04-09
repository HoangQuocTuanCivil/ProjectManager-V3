"use client";

import { useParams, useRouter } from "next/navigation";
import { TaskDetail } from "@/features/tasks";

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  return (
    <TaskDetail
      taskId={taskId}
      onClose={() => router.push("/tasks")}
    />
  );
}
