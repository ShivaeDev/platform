import { Deferred, Effect } from "effect";
import { TodayPage } from "#client/react/TodayPage.tsx";
import { renderBoard } from "./react.tsx";
import { screenData } from "./screenData.ts";
import { trackScreen } from "./screenEngine.ts";
import { screenClient } from "./screenFeatures.tsx";
import { screenOptions } from "./screenReads.ts";
import { screenStory } from "./screenStory.ts";

export function todaySummaryScreen(workspace: "failed" | "pending") {
	return screenStory.trait("screen", `Today opens with a remembered inbox while workspace indexing is ${workspace}`, function* (engine) {
		function tell(line: string) {
			engine.tell?.(line);
		}
		const view = trackScreen(
			engine,
			yield* Effect.promise(() =>
				renderBoard(
					engine.files,
					(client) => {
						screenClient(engine, client);
						return null;
					},
					screenOptions(engine, engine.options),
				),
			),
			tell,
		);
		const inbox = yield* Effect.promise(() => screenData(engine, tell).readInbox());
		engine.indexFailed = workspace === "failed";
		if (workspace === "pending") {
			engine.indexGate = yield* Deferred.make<void>();
		}
		const api = engine.api;
		if (!api) {
			throw new Error("The Board screen has no client");
		}
		yield* Effect.promise(() => view.render(<TodayPage api={api} data={inbox} />));
	});
}
