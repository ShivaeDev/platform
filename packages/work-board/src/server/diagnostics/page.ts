import { Clock, Effect } from "effect";
import type { diagnostics } from "#diagnostics/source.ts";
import type { Changes } from "#server/files/changes.ts";
import { respond } from "#server/http/respond.ts";
import { navHtml } from "#server/page/nav.ts";
import { shell } from "#server/page/shell.ts";
import type { searchSnapshot } from "#server/search/snapshot.ts";
import { diagnosticsHtml } from "./html.ts";

export const diagnosticsPage = Effect.fn("WorkBoard.diagnosticsPage")(function* (
	read: Effect.Success<ReturnType<typeof diagnostics>>,
	changes: Changes,
	home: string | undefined,
	index?: Effect.Success<ReturnType<typeof searchSnapshot>>,
) {
	const result = yield* read;
	const snapshot = index ? yield* index : undefined;
	return respond(
		shell(
			"Diagnostics",
			navHtml(yield* changes.files, "", home, snapshot),
			diagnosticsHtml(result, yield* Clock.currentTimeMillis),
			changes.realRoot,
			true,
			undefined,
			"diagnostics",
			snapshot,
		),
		"text/html",
	);
});
