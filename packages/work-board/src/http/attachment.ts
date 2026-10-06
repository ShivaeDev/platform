import { Effect, FileSystem, Path } from "effect";
import type { HttpServerRequest } from "effect/unstable/http";
import { within } from "#files/list.ts";
import { attachmentType } from "#path/attachment.ts";
import { respond } from "./respond.ts";

const MAX_BYTES = 16 * 1024 * 1024;

export function attachment(root: string, realRoot: string) {
	return Effect.fn("WorkBoard.attachment")(function* (request: HttpServerRequest.HttpServerRequest) {
		function missing() {
			return respond("Local image unavailable: unsupported type, missing file or workspace boundary.", "text/plain", 404);
		}
		let relative: string;
		try {
			relative = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname.slice("/_board/attachment/".length));
		} catch {
			return missing();
		}
		const type = attachmentType(relative);
		if (
			!type
			|| relative.includes("\\")
			|| relative.split("/").some((part) => !part || part === ".." || part.startsWith(".") || part === "node_modules")
		) {
			return missing();
		}
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		return yield* Effect.gen(function* () {
			const real = yield* fs.realPath(path.join(root, relative));
			if (!within(realRoot, path.sep, real)) {
				return missing();
			}
			const info = yield* fs.stat(real);
			if (info.type !== "File") {
				return missing();
			}
			if (info.size > BigInt(MAX_BYTES)) {
				return respond("Local image exceeds the 16 MiB limit.", "text/plain", 413);
			}
			const body = yield* fs.readFile(real);
			return body.byteLength > MAX_BYTES ? respond("Local image exceeds the 16 MiB limit.", "text/plain", 413) : respond(body, type);
		}).pipe(Effect.orElseSucceed(missing));
	});
}
