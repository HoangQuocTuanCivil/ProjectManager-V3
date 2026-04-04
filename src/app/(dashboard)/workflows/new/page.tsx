"use client";

import { useRouter } from "next/navigation";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";

export default function NewWorkflowPage() {
  const router = useRouter();
  return (
    <WorkflowBuilder
      onClose={() => router.push("/workflows")}
      onSave={() => router.push("/workflows")}
    />
  );
}
