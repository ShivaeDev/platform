import { Effect } from "effect";
import type { Changes } from "#files/changes.ts";
import { navHtml } from "#page/nav.ts";
import { shell } from "#page/shell.ts";
import { startHtml } from "#page/startHtml.ts";
import { respond } from "./respond.ts";

export function start(changes: Changes, home: string | undefined) {
	return Effect.fn("WorkBoard.start")(function* () {
		const files = yield* changes.files;
		return respond(
			shell("Getting started", navHtml(files, "", home), startHtml(files.length === 0), changes.realRoot, false, undefined, "start"),
			"text/html",
		);
	});
}
