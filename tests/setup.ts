// Runs before every test file. Makes sure lib/db.ts opens an in-memory
// database instead of touching ./data on disk, and that auth helpers have
// the secrets they need.
process.env.DATABASE_PATH ??= ":memory:";
process.env.SESSION_SECRET ??= "test-session-secret";
process.env.DASHBOARD_PASSWORD ??= "test-password";
