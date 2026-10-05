import { Clock, Effect, FileSystem, Schema } from "effect";
import { HttpIncomingMessage, HttpServerRequest } from "effect/unstable/http";
import type { Changes } from "#files/changes.ts";
import { changesHtml } from "#history/html.ts";
import { MAX_BYTES } from "#history/limits.ts";
import { historyResponse } from "#history/response.ts";
import { HistoryInput, HistoryOutput } from "#history/schema.ts";
import { navHtml } from "#page/nav.ts";
import { shell } from "#page/shell.ts";
import type { searchSnapshot } from "#search/snapshot.ts";
import { respond } from "./respond.ts";

export function changesPage(changes: Changes, home: string | undefined) {
	return Effect.fn("WorkBoard.changesPage")(function* () {
		const nav = navHtml(yield* changes.files, "", home);
		return respond(shell("Changes", nav, changesHtml(), changes.realRoot, true, undefined, "changes"), "text/html");
	});
}
function sameOrigin(request: HttpServerRequest.HttpServerRequest): boolean {
	const origin = request.headers.origin;
	if (origin === undefined) {
		return true;
	}
	try {
		const url = new URL(origin);
		return url.protocol === "http:" && url.host === request.headers.host;
	} catch {
		return false;
	}
}
export function history(index: Effect.Success<ReturnType<typeof searchSnapshot>>) {
	return Effect.fn("WorkBoard.history")(function* (request: HttpServerRequest.HttpServerRequest) {
		if (!sameOrigin(request)) {
			return respond("Local same-origin requests only", "text/plain", 403);
		}
		const decoded = yield* HttpServerRequest.schemaBodyJson(HistoryInput, { onExcessProperty: "error" }).pipe(
			Effect.provideService(HttpServerRequest.HttpServerRequest, request),
			Effect.provideService(HttpIncomingMessage.MaxBodySize, FileSystem.Size(4 * MAX_BYTES + 4096)),
			Effect.result,
		);
		if (decoded._tag === "Failure") {
			return respond("Invalid history query", "text/plain", 400);
		}
		const input = decoded.success;
		const now = yield* Clock.currentTimeMillis;
		const snapshot = input.action === "check" ? undefined : yield* index;
		const output = historyResponse(input.baseline, now, snapshot);
		return respond(Schema.encodeSync(Schema.fromJsonString(HistoryOutput))(output), "application/json");
	});
}
