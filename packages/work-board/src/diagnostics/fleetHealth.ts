import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { Effect, Schema } from "effect";
import { directoryPath, validateDirectory } from "#responses/publicationDirectory.ts";
import { FLEET_HEALTH_NAME, FleetHealth } from "./health.ts";
import { SourceFailure } from "./source.ts";

export function fleetHealth(root: string) {
	return Effect.tryPromise({
		catch: (error) =>
			new SourceFailure({
				kind: error instanceof Error && "code" in error && error.code === "ENOENT" ? "not-configured" : "error",
				message:
					error instanceof Error && "code" in error && error.code === "ENOENT"
						? "Fleet has not published a health snapshot"
						: `Fleet health snapshot could not be read: ${error instanceof Error ? error.message : "unknown error"}`.slice(0, 500),
			}),
		try: async () => {
			const realRoot = await realpath(root);
			const directory = await open(realRoot, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
			try {
				const base = directoryPath(directory, realRoot);
				await validateDirectory(directory, base, realRoot);
				const target = await open(`${base}/fleet`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
				try {
					const folder = directoryPath(target, `${realRoot}/fleet`);
					await validateDirectory(target, folder, `${realRoot}/fleet`);
					const file = await open(`${folder}/${FLEET_HEALTH_NAME}`, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
					try {
						const stat = await file.stat();
						if (!stat.isFile() || stat.size > 64 * 1024) {
							throw new Error("Snapshot must be a regular file under 64 KiB");
						}
						const snapshot = Schema.decodeUnknownSync(Schema.fromJsonString(FleetHealth))(await file.readFile("utf8"));
						await validateDirectory(directory, base, realRoot);
						await validateDirectory(target, folder, `${realRoot}/fleet`);
						return snapshot;
					} finally {
						await file.close();
					}
				} finally {
					await target.close();
				}
			} finally {
				await directory.close();
			}
		},
	});
}
