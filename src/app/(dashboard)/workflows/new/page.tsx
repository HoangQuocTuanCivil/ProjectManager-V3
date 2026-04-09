"use client";

import { useRouter } from "next/navigation";
import { WorkflowBuilder } from "@/features/workflows";

export default function NewWorkflowPage() {
  const router = useRouter();
  return (
    <WorkflowBuilder
      onClose={() => router.push("/workflows")}
      onSave={() => router.push("/workflows")}
    />
  );
}
