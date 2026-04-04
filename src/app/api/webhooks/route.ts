import { NextRequest } from "next/server";
import { getAdminSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";
import { createHmac } from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-webhook-signature");
  const source = req.headers.get("x-webhook-source") || "unknown";

  // Verify signature if webhook secret is configured
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && signature) {
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    if (signature !== expected) {
      return errorResponse("Invalid webhook signature", 401);
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const admin = getAdminSupabase();

  // Log webhook event
  try {
    await admin.from("audit_logs").insert({
      action: "webhook_received",
      resource_type: "webhook",
      resource_id: payload.id || null,
      new_values: { source, event: payload.event || payload.type, payload },
    });
  } catch {
    // Logging failure should not block processing
  }

  // Route by event type
  const event = payload.event || payload.type;

  switch (event) {
    case "task.created":
    case "task.updated":
    case "task.completed":
      // External system notifying about task changes
      break;

    case "payment.completed":
      // External payment system confirming payment
      if (payload.task_id) {
        await admin
          .from("tasks")
          .update({
            metadata: {
              payment_status: "paid",
              payment_amount: payload.amount,
              payment_date: new Date().toISOString(),
              payment_ref: payload.reference,
            },
          })
          .eq("id", payload.task_id);
      }
      break;

    default:
      // Unknown event — just log it
      break;
  }

  return jsonResponse({ received: true, event, source });
}
