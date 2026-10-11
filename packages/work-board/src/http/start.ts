import { Effect } from "effect";
import type { Changes } from "#files/changes.ts";
import { navHtml } from "#page/nav.ts";
import { shell } from "#page/shell.ts";
import { startHtml } from "#page/startHtml.ts";
import type { searchSnapshot } from "#search/snapshot.ts";
import { respond } from "./respond.ts";

export function start(changes: Changes, home: string | undefined, index?: Effect.Success<ReturnType<typeof searchSnapshot>>) {
	return Effect.fn("WorkBoard.start")(function* () {
		const files = yield* changes.files;
		const snapshot = index ? yield* index : undefined;
		return respond(
			shell(
				"Getting started",
				navHtml(files, "", home, snapshot),
				startHtml(files.length === 0),
				changes.realRoot,
				false,
				undefined,
				"start",
				snapshot,
			),
			"text/html",
		);
	});
}
