import { expect } from "vitest";
import { commandReconnect, connected } from "#test/command-reconnect/story.tsx";

for (const source of ["visibilitychange", "online", "pageshow"] as const) {
	commandReconnect.it(
		`${source} detects a silent socket, shows Reconnecting while saving and delivers the save`,
		[connected],
		function* ({ silence, resume, save, untilWaiting, pass, settle, shown }) {
			yield* silence();
			yield* resume(source);
			yield* save();
			yield* untilWaiting();

			expect(yield* shown()).toEqual({ connection: "Reconnecting", pending: true, result: "Saved" });

			yield* pass(3500);
			yield* settle();

			expect(yield* shown()).toEqual({ connection: "live", pending: false, result: "Saved" });
		},
	);
}

commandReconnect.it(
	"a save issued during reconnect stays pending with Reconnecting until delivered",
	[connected],
	function* ({ drop, save, untilWaiting, shown, restore, pass, settle }) {
		yield* drop();
		yield* save();
		yield* untilWaiting();

		expect(yield* shown()).toEqual({ connection: "Reconnecting", pending: true, result: "Saved" });

		yield* restore();
		yield* pass(1000);
		yield* settle();

		expect(yield* shown()).toEqual({ connection: "live", pending: false, result: "Saved" });
	},
);

commandReconnect.it(
	"a held save exposes a typed connection timeout after ten seconds",
	[connected],
	function* ({ drop, save, untilWaiting, pass, untilTimeout, shown }) {
		yield* drop();
		yield* save();
		yield* untilWaiting();

		yield* pass(10_000);
		yield* untilTimeout();

		expect(yield* shown()).toMatchObject({ pending: false, result: "RpcClientError: SocketOpenError Timeout" });
	},
);
