import { Clock, Effect } from "effect";
import { inboxHtml } from "#attention/inboxHtml.ts";
import type { Changes } from "#files/changes.ts";
import { navHtml } from "#page/nav.ts";
import { shell } from "#page/shell.ts";
import type { searchSnapshot } from "#search/snapshot.ts";
import { respond } from "./respond.ts";

export function inbox(index: Effect.Success<ReturnType<typeof searchSnapshot>>, changes: Changes, home: string | undefined) {
	return Effect.fn("WorkBoard.inbox")(function* () {
		const snapshot = yield* index;
		return respond(
			shell(
				"Inbox",
				navHtml(yield* changes.files, "", home, snapshot),
				inboxHtml(snapshot, false, yield* Clock.currentTimeMillis),
				changes.realRoot,
				true,
				undefined,
				"inbox",
			),
			"text/html",
			snapshot.unavailable.length > 0 ? 503 : 200,
		);
	});
}
