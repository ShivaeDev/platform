// @ts-expect-error A call written for the application root no longer compiles; loadMigrationsIn takes the folder that contains `migrations`.
import { migrationsFromDirectory } from "#migrationsFromDirectory.ts";

migrationsFromDirectory("/srv/app");
