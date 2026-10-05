import { Effect } from "effect";
import type { HttpServerRequest } from "effect/unstable/http";
import { searchMatch } from "#search/match.ts";
import type { searchSnapshot } from "#search/snapshot.ts";
import { respond } from "./respond.ts";

export function search(index: Effect.Success<ReturnType<typeof searchSnapshot>>) {
	return Effect.fn("WorkBoard.search")(function* (request: HttpServerRequest.HttpServerRequest) {
		const query = new URL(request.url, "http://127.0.0.1").searchParams.get("q") ?? "";
		const snapshot = yield* index;
		return respond(JSON.stringify({ ...searchMatch(snapshot.entries, query), unavailable: snapshot.unavailable }), "application/json");
	});
}
