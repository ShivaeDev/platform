import files from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { vi } from "vitest";

export const changedReportAttachment = Effect.gen(function* () {
	const folder = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped();
	const name = "evidence.txt";
	const target = join(folder, name);
	yield* Effect.promise(() => files.writeFile(target, "validated bytes"));
	const open = files.open;
	const mock = yield* Effect.acquireRelease(
		Effect.sync(() => vi.spyOn(files, "open")),
		(spy) =>
			Effect.sync(() => {
				spy.mockRestore();
				syncBuiltinESMExports();
			}),
	);
	mock.mockImplementation(async (path, flags, mode) => {
		if (path === target) {
			await files.rename(target, `${target}.original`);
			await files.writeFile(target, "replacement bytes");
		}
		return open(path, flags, mode);
	});
	syncBuiltinESMExports();
	return { folder, name };
});
