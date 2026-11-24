import { createClient } from "@/lib/supabase/server";

/**
 * Whether the signed-in caller is an editor of مرجع المعادلة.
 *
 * This decides what the UI shows. It is not the security boundary: every
 * write also passes the RLS policies on the eq_* tables, which call the same
 * is_eq_editor() function in the database.
 */
export async function getEditor() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { supabase, user: null, isEditor: false } as const;
  const { data } = await supabase.rpc("is_eq_editor");
  return { supabase, user: userData.user, isEditor: data === true } as const;
}

/** For server actions: throws unless the caller is an editor. */
export async function requireEditor() {
  const ctx = await getEditor();
  if (!ctx.user || !ctx.isEditor) throw new Error("غير مصرّح");
  return ctx;
}
