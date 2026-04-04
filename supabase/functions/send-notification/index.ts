// supabase/functions/send-notification/index.ts
// Multi-channel notification dispatcher: Email (Resend), Push, Telegram, Webhook

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { notification_id, channels } = await req.json().catch(() => ({ notification_id: null, channels: [] }));

  if (!notification_id) {
    return new Response(JSON.stringify({ error: "notification_id required" }), { status: 400 });
  }

  // Get notification + user
  const { data: notif } = await supabase
    .from("notifications")
    .select("*, user:users(id, email, full_name, settings)")
    .eq("id", notification_id)
    .single();

  if (!notif?.user) {
    return new Response(JSON.stringify({ error: "Notification or user not found" }), { status: 404 });
  }

  // Get org notification settings
  const { data: orgSettings } = await supabase
    .from("org_settings")
    .select("key, value")
    .eq("org_id", notif.org_id)
    .eq("category", "notification");

  const settings: Record<string, any> = {};
  (orgSettings || []).forEach((s) => (settings[s.key] = s.value));

  const results: Record<string, boolean> = {};

  // ─── Email (Resend) ────────────────────────────────────────────
  const emailEnabled = settings.email_enabled !== false && notif.user.settings?.notifications_email !== false;
  if (emailEnabled && Deno.env.get("RESEND_API_KEY")) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        },
        body: JSON.stringify({
          from: Deno.env.get("RESEND_FROM_EMAIL") || "A2Z WorkHub <noreply@workhub.a2z.com.vn>",
          to: notif.user.email,
          subject: `[WorkHub] ${notif.title}`,
          html: `
            <div style="font-family: system-ui; max-width: 500px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #38bdf8; font-size: 16px;">${notif.title}</h2>
              <p style="color: #333; font-size: 14px; line-height: 1.6;">${notif.body || ""}</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="color: #999; font-size: 11px;">A2Z WorkHub — Nền tảng quản lý công việc & KPI</p>
            </div>
          `,
        }),
      });
      results.email = res.ok;
    } catch (e) {
      results.email = false;
    }
  }

  // ─── Telegram ──────────────────────────────────────────────────
  const telegramEnabled = settings.telegram_enabled === true;
  const botToken = settings.telegram_bot_token;
  if (telegramEnabled && botToken) {
    try {
      // Would need user's telegram_chat_id stored in user settings
      const chatId = notif.user.settings?.telegram_chat_id;
      if (chatId) {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `📋 *${notif.title}*\n${notif.body || ""}`,
            parse_mode: "Markdown",
          }),
        });
        results.telegram = res.ok;
      }
    } catch (e) {
      results.telegram = false;
    }
  }

  // ─── Webhook ───────────────────────────────────────────────────
  const webhookUrl = settings.webhook_url;
  if (webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: notif.type,
          title: notif.title,
          body: notif.body,
          user_id: notif.user_id,
          data: notif.data,
          timestamp: new Date().toISOString(),
        }),
      });
      results.webhook = res.ok;
    } catch (e) {
      results.webhook = false;
    }
  }

  return new Response(JSON.stringify({ success: true, channels: results }), {
    headers: { "Content-Type": "application/json" },
  });
});
