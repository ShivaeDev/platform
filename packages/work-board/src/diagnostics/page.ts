import { Clock, Effect } from "effect";
import type { Changes } from "#files/changes.ts";
import { respond } from "#http/respond.ts";
import { navHtml } from "#page/nav.ts";
import { shell } from "#page/shell.ts";
import { diagnosticsHtml } from "./html.ts";
import type { diagnostics } from "./source.ts";

export const diagnosticsPage = Effect.fn("WorkBoard.diagnosticsPage")(function* (
	read: Effect.Success<ReturnType<typeof diagnostics>>,
	changes: Changes,
	home: string | undefined,
) {
	const result = yield* read;
	return respond(
		shell(
			"Diagnostics",
			navHtml(yield* changes.files, "", home),
			diagnosticsHtml(result, yield* Clock.currentTimeMillis),
			changes.realRoot,
			true,
			undefined,
			"diagnostics",
		),
		"text/html",
	);
});
