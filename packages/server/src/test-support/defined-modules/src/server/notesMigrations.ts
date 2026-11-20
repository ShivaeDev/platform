import { migrationsIn } from "#migrationsIn.ts";

// Laid out like an application's src/server, whose migrations folder sits beside the registration that loads it.
export const notesMigrations = migrationsIn(import.meta.dirname);
