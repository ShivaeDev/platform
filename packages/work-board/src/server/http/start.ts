import { Effect } from "effect";
import type { Changes } from "#server/files/changes.ts";
import { navHtml } from "#server/page/nav.ts";
import { shell } from "#server/page/shell.ts";
import { startHtml } from "#server/page/startHtml.ts";
import type { searchSnapshot } from "#server/search/snapshot.ts";
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
