import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const redirectTo = searchParams.get("redirect_to") || "/";

  const supabase = await createServerSupabase();

  // PKCE flow: exchange code for session (login, OAuth)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(redirectTo, req.url));
    }
  }

  // Token hash flow: password recovery, email confirmation
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as any });
    if (!error) {
      // Password recovery → redirect to reset-password page
      if (type === "recovery") {
        return NextResponse.redirect(new URL("/reset-password", req.url));
      }
      return NextResponse.redirect(new URL(redirectTo, req.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback_failed", req.url));
}
