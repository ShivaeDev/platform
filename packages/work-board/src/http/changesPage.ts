import { Effect } from "effect";
import type { Changes } from "#files/changes.ts";
import { changesHtml } from "#history/html.ts";
import { navHtml } from "#page/nav.ts";
import { shell } from "#page/shell.ts";
import type { searchSnapshot } from "#search/snapshot.ts";
import { respond } from "./respond.ts";

export function changesPage(changes: Changes, home: string | undefined, index?: Effect.Success<ReturnType<typeof searchSnapshot>>) {
	return Effect.fn("WorkBoard.changesPage")(function* () {
		const snapshot = index ? yield* index : undefined;
		const nav = navHtml(yield* changes.files, "", home, snapshot);
		return respond(shell("Changes", nav, changesHtml(), changes.realRoot, true, undefined, "changes", snapshot), "text/html");
	});
}
