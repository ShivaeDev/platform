import { Effect } from "effect";
import type { Changes } from "#server/files/changes.ts";
import { changesHtml } from "#server/history/html.ts";
import { navHtml } from "#server/page/nav.ts";
import { shell } from "#server/page/shell.ts";
import type { searchSnapshot } from "#server/search/snapshot.ts";
import { respond } from "./respond.ts";

export function changesPage(changes: Changes, home: string | undefined, index?: Effect.Success<ReturnType<typeof searchSnapshot>>) {
	return Effect.fn("WorkBoard.changesPage")(function* () {
		const snapshot = index ? yield* index : undefined;
		const nav = navHtml(yield* changes.files, "", home, snapshot);
		return respond(shell("Changes", nav, changesHtml(), changes.realRoot, true, undefined, "changes", snapshot), "text/html");
	});
}
