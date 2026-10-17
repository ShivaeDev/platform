import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { routeQueryOptions } from "#client/page/routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";

export function pageQueries(api: ShellApi, kind: string, url: string): readonly Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>[] {
	if (kind === "today") {
		return [
			api.inbox.query(undefined, routeQueryOptions),
			api.goals.query(undefined, routeQueryOptions),
			api.fleetItems.query(undefined, routeQueryOptions),
		];
	}
	if (kind === "library") {
		return [api.library.query({}, routeQueryOptions)];
	}
	if (kind === "goals") {
		return [api.goals.query(undefined, routeQueryOptions)];
	}
	if (kind === "start") {
		return [api.start.query(undefined, routeQueryOptions)];
	}
	if (kind === "system") {
		return [api.diagnostics.query(undefined, routeQueryOptions), api.fleetItems.query(undefined, routeQueryOptions)];
	}
	if (kind === "work") {
		return [api.work.query({ url }, routeQueryOptions)];
	}
	if (kind === "board") {
		return [api.board.query({ url }, routeQueryOptions)];
	}
	if (kind === "handoff") {
		return [api.handoff.query({ url }, routeQueryOptions)];
	}
	if (kind === "result") {
		return [api.result.query({ url }, routeQueryOptions)];
	}
	return [api.document.query({ url }, routeQueryOptions)];
}
