import { Effect } from "effect";
import { overviewHtml } from "#attention/overviewHtml.ts";
import type { Changes } from "#files/changes.ts";
import { navHtml } from "#page/nav.ts";
import { shell } from "#page/shell.ts";
import type { searchSnapshot } from "#search/snapshot.ts";
import { respond } from "./respond.ts";

export function overview(index: Effect.Success<ReturnType<typeof searchSnapshot>>, changes: Changes, home: string | undefined) {
	return Effect.fn("WorkBoard.overview")(function* () {
		const snapshot = yield* index;
		const nav = navHtml(yield* changes.files, "", home);
		return respond(
			shell("Overview", nav, overviewHtml(snapshot), changes.realRoot, true, undefined, "overview"),
			"text/html",
			snapshot.unavailable.length > 0 ? 503 : 200,
		);
	});
}
