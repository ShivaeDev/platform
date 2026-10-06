import { constants } from "node:fs";
import { mkdir, open, realpath } from "node:fs/promises";
import { Effect } from "effect";
import { ResponseFailed } from "#browser/responses/schema.ts";
import { publishIn } from "./publishIn.ts";

function failure(cause: unknown): ResponseFailed {
	return cause instanceof ResponseFailed
		? cause
		: new ResponseFailed({
				code: "Unavailable",
				message: "The local record could not be recorded. Keep the draft and retry after checking local filesystem access.",
			});
}
export function publish(root: string, realRoot: string, id: string, content: string, namespace: "responses" | "handoffs" = "responses") {
	return Effect.tryPromise({
		catch: failure,
		try: async () => {
			if (/^[a-zA-Z\d][a-zA-Z\d._-]*$/u.exec(id) === null) {
				throw new ResponseFailed({ code: "Conflict", message: "Invalid record identity." });
			}
			if (process.platform !== "linux") {
				throw new ResponseFailed({
					code: "Unsupported",
					message: "Local record publication currently requires Linux directory descriptors. Reading remains available.",
				});
			}
			const directory = await open(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
			try {
				const base = `/proc/self/fd/${directory.fd}`;
				if ((await realpath(base)) !== realRoot || (await realpath(root)) !== realRoot) {
					throw new ResponseFailed({ code: "Conflict", message: "The workspace root changed. Restart against the intended root." });
				}
				try {
					await mkdir(`${base}/${namespace}`);
				} catch (cause) {
					if (!(cause instanceof Error && "code" in cause && cause.code === "EEXIST")) {
						throw cause;
					}
				}
				await directory.sync();
				const target = await open(`${base}/${namespace}`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
				try {
					await publishIn(target, root, realRoot, id, content, namespace);
				} finally {
					await target.close();
				}
			} finally {
				await directory.close();
			}
		},
	});
}
