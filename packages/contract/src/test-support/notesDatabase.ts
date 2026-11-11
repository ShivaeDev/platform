import { notesPostgres } from "@shivaedev/test-kits/test-support/notes/postgres.ts";

export const notesDatabase = notesPostgres("PLATFORM_SQL_TEST_DATABASE_URL");
