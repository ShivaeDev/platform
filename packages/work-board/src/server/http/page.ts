import { Effect, FileSystem } from "effect";
import type { HttpServerRequest } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { currentDocument } from "#server/currentDocument.ts";
import type { Changes } from "#server/files/changes.ts";
import { markdownPath } from "#server/files/markdownPath.ts";
import { shell } from "#server/page/shell.ts";
import type { searchSnapshot } from "#server/search/snapshot.ts";
import { respond } from "./respond.ts";

export interface PageOptions {
	readonly home: string | undefined;
	readonly root: string;
	readonly writable?: boolean;
}
function requestedPath(url: string): string {
	const pathname = new URL(url, "http://127.0.0.1").pathname.replace(/^\/+/u, "");
	try {
		return decodeURIComponent(pathname);
	} catch {
		return pathname;
	}
}
export function page(options: PageOptions, changes: Changes, index: Effect.Success<ReturnType<typeof searchSnapshot>>) {
	return Effect.fn("WorkBoard.page")(function* (request: HttpServerRequest.HttpServerRequest, resolved?: string, expectedIdentity?: string) {
		const requested = resolved ?? requestedPath(request.url);
		function layout(status: number) {
			return respond(shell(requested || "Today", changes.realRoot), "text/html", status);
		}
		if (!(requested || expectedIdentity)) {
			return layout(HttpStatus.fromLiteral("OK"));
		}
		const file = (yield* changes.files).find((candidate) => candidate.path === requested);
		if (!file) {
			return layout(HttpStatus.fromLiteral("NotFound"));
		}
		return yield* Effect.gen(function* () {
			const real = yield* markdownPath(options.root, changes.realRoot, file.path);
			if (!real) {
				return layout(HttpStatus.fromLiteral("NotFound"));
			}
			const fs = yield* FileSystem.FileSystem;
			const source = yield* fs.readFileString(real);
			if (expectedIdentity) {
				const { document, snapshot } = currentDocument(yield* index, file.path, source, options.home);
				if (document.parsed.fields.id !== expectedIdentity || snapshot.model.ids.get(expectedIdentity)?.length !== 1) {
					return layout(HttpStatus.fromLiteral("NotFound"));
				}
			}
			return layout(HttpStatus.fromLiteral("OK"));
		}).pipe(Effect.catch(() => Effect.succeed(layout(HttpStatus.fromLiteral("InternalServerError")))));
	});
}
