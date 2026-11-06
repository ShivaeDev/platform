import { posix } from "node:path";
import { moduleRoot } from "./moduleRoot.ts";

export const MIGRATIONS_DIRECTORY = "src/server/migrations";
export const MIGRATION_FILE_PATTERN = /^[0-9]{4}_[a-z][a-z0-9]*(?:_[a-z0-9]+)*\.ts$/u;

export function isMigrationFile(path: string): boolean {
	const directory = posix.dirname(path);
	const conventional = directory === MIGRATIONS_DIRECTORY || directory.endsWith(`/${MIGRATIONS_DIRECTORY}`);
	const root = moduleRoot(path);
	const modular = root !== undefined && directory === `${root}/server/migrations`;
	return (conventional || modular) && MIGRATION_FILE_PATTERN.test(posix.basename(path));
}
