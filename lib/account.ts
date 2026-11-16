import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "source-cvs";

/** Remove every stored file under the user's private folder (paged). */
export async function removeUserFiles(userId: string): Promise<number> {
  const admin = createAdminClient();
  let removed = 0;
  for (let page = 0; page < 50; page++) {
    const { data, error } = await admin.storage.from(BUCKET).list(userId, { limit: 100 });
    if (error) throw error;
    if (!data?.length) break;
    const paths = data.map((f) => `${userId}/${f.name}`);
    const { error: rmError } = await admin.storage.from(BUCKET).remove(paths);
    if (rmError) throw rmError;
    removed += paths.length;
    if (data.length < 100) break;
  }
  return removed;
}

/**
 * Permanently delete an account: private files first, then the auth user.
 * All database rows cascade from auth.users -> profiles -> owned tables.
 * Anonymous AI usage counts are retained (user_id set to NULL).
 */
export async function deleteAccountCompletely(userId: string): Promise<void> {
  await removeUserFiles(userId);
  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error) throw error;
}
