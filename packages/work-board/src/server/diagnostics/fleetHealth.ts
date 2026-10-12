import { constants } from "node:fs";
import { type FileHandle, open, realpath } from "node:fs/promises";
import { Effect, Schema } from "effect";
import { FLEET_HEALTH_NAME, FleetHealth } from "#diagnostics/health.ts";
import { SourceFailure } from "#diagnostics/source.ts";
import { directoryPath, validateDirectory } from "#server/responses/publicationDirectory.ts";

function readFailure(error: unknown): SourceFailure {
	if (error instanceof SourceFailure) {
		return error;
	}
	if (error instanceof Error && "code" in error && error.code === "ENOENT") {
		return new SourceFailure({ kind: "not-configured", message: "Fleet has not published a health snapshot" });
	}
	return new SourceFailure({
		kind: "error",
		message: `Fleet health snapshot could not be read: ${error instanceof Error ? error.message : "unknown error"}`.slice(0, 500),
	});
}
async function readSnapshot(file: FileHandle): Promise<FleetHealth> {
	const stat = await file.stat();
	if (!stat.isFile() || stat.size > 64 * 1024) {
		throw new Error("Snapshot must be a regular file under 64 KiB");
	}
	const source = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown))(await file.readFile("utf8"));
	const { version } = Schema.decodeUnknownSync(Schema.Struct({ version: Schema.Int }))(source);
	if (version !== 2) {
		throw new SourceFailure({ kind: "error", message: `Fleet health snapshot version ${version} is not supported by this Board` });
	}
	return Schema.decodeUnknownSync(FleetHealth)(source);
}

export function fleetHealth(root: string) {
	return Effect.tryPromise({
		catch: readFailure,
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
						const snapshot = await readSnapshot(file);
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
