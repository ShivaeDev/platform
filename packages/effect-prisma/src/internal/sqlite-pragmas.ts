import { DatabaseSync } from "node:sqlite";

export const MEMORY_PATH = ":memory:";

/**
 * Prisma Next's SQLite driver opens a fresh `node:sqlite` connection for every
 * `RuntimeConnection`, so an in-memory database would give each transaction its
 * own empty database.
 */
export const assertFileBackedPath = (path: string): void => {
	if (path === MEMORY_PATH || path.trim().length === 0) {
		throw new TypeError(
			"Effect Prisma requires a file-backed SQLite database; transactions run on their own connection and cannot see an in-memory database",
		);
	}
};

/**
 * Apply connect-time pragmas.
 *
 * The driver already sets `foreign_keys` and `busy_timeout` on every connection
 * it opens, but it has no hook for anything else, so durable pragmas such as
 * `journal_mode` are applied once against the database file itself.
 */
export const applySqlitePragmas = (
	path: string,
	pragmas: ReadonlyArray<string>,
): void => {
	if (pragmas.length === 0) {
		return;
	}

	const database = new DatabaseSync(path);
	try {
		for (const pragma of pragmas) {
			database.exec(`PRAGMA ${pragma}`);
		}
	} finally {
		database.close();
	}
};
