import { Effect } from "effect";
import type { HttpServerRequest } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import type { Changes } from "#server/files/changes.ts";
import { shell } from "#server/page/shell.ts";
import type { searchSnapshot } from "#server/search/snapshot.ts";
import type { page } from "./page.ts";
import { respond } from "./respond.ts";

export function identity(index: Effect.Success<ReturnType<typeof searchSnapshot>>, pages: ReturnType<typeof page>, changes: Changes) {
	return Effect.fn("WorkBoard.identity")(function* (request: HttpServerRequest.HttpServerRequest) {
		const encoded = /^\/_board\/item\/(?<id>[^/]+)\/?$/u.exec(new URL(request.url, "http://127.0.0.1").pathname)?.groups?.id;
		if (encoded === undefined) {
			return yield* pages(request);
		}
		let id: string;
		try {
			id = decodeURIComponent(encoded);
		} catch {
			id = "";
		}
		const snapshot = yield* index;
		const matches = snapshot.model.ids.get(id) ?? [];
		if (snapshot.unavailable.length === 0 && matches.length === 1 && matches[0]) {
			return yield* pages(request, matches[0].file, id);
		}
		let status: number = matches.length > 0 ? HttpStatus.fromLiteral("Conflict") : HttpStatus.fromLiteral("NotFound");
		if (snapshot.unavailable.length > 0) {
			status = HttpStatus.fromLiteral("ServiceUnavailable");
		}
		return respond(shell(`Item ${id}`, changes.realRoot), "text/html", status);
	});
}
