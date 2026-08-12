import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));

export interface TemporaryDatabase {
	readonly path: string;
	readonly remove: () => void;
}

export const makeTemporaryDatabase = (): TemporaryDatabase => {
	const directory = mkdtempSync(join(tmpdir(), "effect-prisma-sqlite-"));
	const path = join(directory, "test.db");
	const database = new DatabaseSync(path);
	try {
		database.exec(readFileSync(schemaPath, "utf8"));
	} finally {
		database.close();
	}

	return {
		path,
		remove: () => rmSync(directory, { force: true, recursive: true }),
	};
};
