import { Effect } from "effect";
import type { HttpServerRequest } from "effect/unstable/http";
import type { Changes } from "#files/changes.ts";
import { escapeHtml } from "#page/escape.ts";
import { navHtml } from "#page/nav.ts";
import { shell } from "#page/shell.ts";
import type { searchSnapshot } from "#search/snapshot.ts";
import { stateOf } from "#views/state.ts";
import { workHtml } from "#views/workHtml.ts";
import { respond } from "./respond.ts";

export function work(index: Effect.Success<ReturnType<typeof searchSnapshot>>, changes: Changes, home: string | undefined) {
	return Effect.fn("WorkBoard.work")(function* (request: HttpServerRequest.HttpServerRequest) {
		const snapshot = yield* index;
		const nav = navHtml(yield* changes.files, "", home);
		if (snapshot.unavailable.length > 0) {
			return respond(
				shell(
					"Work",
					nav,
					`<h1>Workspace incomplete</h1><p class="empty">Could not read ${escapeHtml(snapshot.unavailable.join(", "))}. Work identity and view counts cannot be validated. Read available source files or retry when the workspace is readable.</p>`,
					changes.realRoot,
					true,
					undefined,
					true,
				),
				"text/html",
				503,
			);
		}
		const result = yield* workHtml(snapshot, stateOf(request.url)).pipe(
			Effect.catch(() =>
				Effect.succeed({
					html: '<h1>Work unavailable</h1><p class="empty">The selected source could not be rendered. Read its Markdown file or retry.</p>',
					status: 500,
				}),
			),
		);
		return respond(shell("Work", nav, result.html, changes.realRoot, true, undefined, true), "text/html", result.status);
	});
}
