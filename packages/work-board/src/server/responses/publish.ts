import { constants } from "node:fs";
import { mkdir, open, realpath } from "node:fs/promises";
import process from "node:process";
import { Effect, Schema } from "effect";
import { BadRequest, Conflict, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { PublicationUncertain, ResponseRejection } from "#rpc/rejections.ts";
import { directoryPath, publicationFailure, validateDirectory } from "./publicationDirectory.ts";
import { publishIn } from "./publishIn.ts";

function failure(cause: unknown): ResponseRejection {
	return Schema.is(ResponseRejection)(cause)
		? cause
		: Object.defineProperty(
				new ServiceUnavailable({
					message: "The local record could not be recorded. Keep the draft and retry after checking local filesystem access.",
				}),
				"cause",
				{ value: cause },
			);
}
async function createDirectory(path: string) {
	try {
		await mkdir(path);
	} catch (cause) {
		if (!(cause instanceof Error && "code" in cause && cause.code === "EEXIST")) {
			throw cause;
		}
	}
}
export function publish(root: string, realRoot: string, id: string, content: string, namespace: "responses" | "handoffs" = "responses") {
	return Effect.tryPromise({
		catch: failure,
		try: async () => {
			if (/^[a-zA-Z\d][a-zA-Z\d._-]*$/u.exec(id) === null) {
				throw new Conflict({ message: "Invalid record identity." });
			}
			if (process.platform !== "linux" && process.platform !== "darwin") {
				throw new BadRequest({
					message: "Local record publication requires Linux or macOS. Reading remains available.",
				});
			}
			let published = false;
			const directory = await open(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
			try {
				const base = directoryPath(directory, realRoot);
				await validateDirectory(directory, base, realRoot);
				if ((await realpath(root)) !== realRoot) {
					throw new Conflict({ message: "The workspace root changed. Restart against the intended root." });
				}
				await createDirectory(`${base}/${namespace}`);
				await validateDirectory(directory, base, realRoot);
				await directory.sync();
				const target = await open(`${base}/${namespace}`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
				try {
					await validateDirectory(directory, base, realRoot);
					await publishIn(target, root, realRoot, id, content, namespace).catch((cause: unknown) => {
						published = cause instanceof PublicationUncertain;
						throw cause;
					});
					published = true;
					await validateDirectory(directory, base, realRoot);
				} finally {
					await target.close();
				}
			} catch (cause) {
				publicationFailure(cause, published);
			} finally {
				await directory.close().catch((cause: unknown) => publicationFailure(cause, published));
			}
		},
	});
}
