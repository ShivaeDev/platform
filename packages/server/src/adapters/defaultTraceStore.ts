import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { Effect } from "effect";

const PREFIX = "shivaedev-server-";

function createPrivately(folder: string) {
	try {
		mkdirSync(folder, { mode: 0o700 });
	} catch (cause) {
		if (!(cause instanceof Error && "code" in cause && cause.code === "EEXIST")) {
			throw cause;
		}
	}
}

function isPrivate(folder: string, user: number | undefined) {
	const found = lstatSync(folder);
	return found.isDirectory() && (user === undefined || (found.uid === user && (found.mode & 0o077) === 0));
}

function temporaryFolder(workingDirectory: string) {
	// Other users of a shared temporary directory can make a folder or a link under any name first. Windows has no user ids and gives each user a temporary directory of their own.
	const user = process.getuid?.();
	const name = createHash("sha256").update(workingDirectory).digest("hex").slice(0, 12);
	const stable = join(tmpdir(), `${PREFIX}${user === undefined ? "" : `${user}-`}${name}`);
	createPrivately(stable);
	return isPrivate(stable, user) ? { folder: stable, refused: undefined } : { folder: mkdtempSync(join(tmpdir(), PREFIX)), refused: stable };
}

export const defaultTraceStore = Effect.try(() => {
	const workingDirectory = process.cwd();
	const installed = join(workingDirectory, "node_modules");
	if (existsSync(installed)) {
		return { path: join(installed, ".cache", "@shivaedev", "server", "traces.db"), refused: undefined, temporary: false, workingDirectory };
	}
	// No node_modules folder is created here: an ignore rule anchored at a repository's root would not cover it, and the store could be committed.
	const { folder, refused } = temporaryFolder(workingDirectory);
	return { path: join(folder, "traces.db"), refused, temporary: true, workingDirectory };
});
