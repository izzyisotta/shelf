// Shared helper: detect "groups migration not run yet" so the UI can say so
// instead of erroring. Postgres 42P01 = undefined_table.
export function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || /does not exist/i.test(error.message || "");
}

export const NEEDS_MIGRATION = {
  needsMigration: true,
  error: "Groups aren't switched on yet - the database migration hasn't run.",
};
