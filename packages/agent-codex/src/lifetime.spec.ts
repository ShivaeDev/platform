import { expect } from "@effect/vitest";
import { codex } from "#test/codexStory.ts";

codex.it("Codex census and the shared backend use one app-server process", [], function* ({ start, census, processEvents }) {
	yield* start();
	yield* census();

	expect(yield* processEvents()).toEqual(["started"]);
});

codex.it(
	"the app-server outlives a caller session and stops when its Layer closes",
	[],
	function* ({ start, closeSession, closeAdapter, processEvents }) {
		yield* start();
		yield* closeSession();

		expect(yield* processEvents()).toEqual(["started"]);

		yield* closeAdapter();

		expect(yield* processEvents()).toEqual(["started", "stopped"]);
	},
);
