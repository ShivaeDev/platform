import { constants } from "node:fs";
import { access, realpath } from "node:fs/promises";
import { Effect } from "effect";
import { FilesystemFailure } from "#inventory/filesystem.ts";

export function executable(file: string): Effect.Effect<string | undefined> {
	return Effect.tryPromise({
		catch: (cause) => new FilesystemFailure({ message: String(cause), path: file }),
		try: async () => {
			await access(file, constants.X_OK);
			return realpath(file);
		},
	}).pipe(Effect.match({ onFailure: () => undefined, onSuccess: (path) => path }));
}
