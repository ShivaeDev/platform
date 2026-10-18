import { DatabaseSync } from "node:sqlite";

export const MEMORY_PATH = ":memory:";

// Prisma Next's SQLite driver opens a fresh `node:sqlite` connection per `RuntimeConnection`, so each transaction would get its own empty in-memory database.
export const assertFileBackedPath = (path: string): void => {
	if (path === MEMORY_PATH || path.trim().length === 0) {
		throw new TypeError(
			"Effect Prisma requires a file-backed SQLite database; transactions run on their own connection and cannot see an in-memory database",
		);
	}
};

// The driver has no hook for pragmas beyond `foreign_keys` and `busy_timeout`, so durable ones such as `journal_mode` go to the file once.
export const applySqlitePragmas = (path: string, pragmas: readonly string[]): void => {
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
