import { expect } from "vitest";
import { attempt } from "#test/attempt.ts";
import { eventScreen, idle, noPending, pendingStream } from "#test/eventScreen.ts";

eventScreen.it("settles on a rendered mutation with a pending sampler", [], function* ({ startsSettling, progress, completeAndPaint, finished }) {
	yield* startsSettling();
	expect(yield* progress("settle")).toBe("waiting");

	yield* completeAndPaint("Ready");

	expect(yield* finished("settle")).toBe("succeeded");
});

for (const [how, traits] of [
	["a sampler", []],
	["a stream", [pendingStream]],
] as const) {
	eventScreen.it(
		`find waits for pending work with ${how} even when the target exists`,
		traits,
		function* ({ startsFinding, progress, completeAndPaint, finished }) {
			yield* startsFinding("output");
			expect(yield* progress("find")).toBe("waiting");

			yield* completeAndPaint("Ready");

			expect(yield* finished("find")).toBe("Ready");
		},
	);
}

for (const operation of ["settle", "find"] as const) {
	eventScreen.it(
		`${operation} stays pending through mutations, then resolves and unsubscribes on an idle stream event without another render`,
		[pendingStream],
		function* ({ startsSettling, startsFinding, paint, progress, complete, finished, subscriptionState }) {
			if (operation === "settle") {
				yield* startsSettling();
			} else {
				yield* startsFinding("output");
			}
			yield* paint("Still loading");
			expect(yield* progress(operation)).toBe("waiting");

			yield* complete();

			expect(yield* finished(operation)).toBe(operation === "settle" ? "succeeded" : "Still loading");
			expect(subscriptionState()).toBe("unsubscribed");
		},
	);
}

for (const [how, traits] of [
	["without pending", [noPending]],
	["with an idle stream", [pendingStream, idle]],
] as const) {
	eventScreen.it(`find waits for a named target to render ${how}`, traits, function* ({ startsFinding, progress, paint, finished }) {
		yield* startsFinding({ name: "Ready", role: "status" });
		expect(yield* progress("find")).toBe("waiting");

		yield* paint("Ready");

		expect(yield* finished("find")).toBe("Ready");
	});
}

eventScreen.it("find observes a replacement root supplied by a getter", [noPending], function* ({ startsFinding, replaceScreen, finished }) {
	yield* startsFinding({ name: "Ready", role: "status" });

	yield* replaceScreen("Ready");

	expect(yield* finished("find")).toBe("Ready");
});

for (const operation of ["settle", "find"] as const) {
	eventScreen.it(
		`${operation} reports pending work that never completes and releases its stream`,
		[pendingStream],
		function* ({ settle, find, subscriptionState }) {
			const result = yield* attempt(operation === "settle" ? settle({ timeoutMs: 40 }) : find("output", { timeout: 40 }));

			expect(result).toBe(
				"died: The screen did not settle within 40ms.\nhelp: Release held requests and check the app's pending signal and renderer act adapter.\nScreen: Loading",
			);
			expect(subscriptionState()).toBe("unsubscribed");
		},
	);
}

eventScreen.it("find reacts when only the target's accessible name changes", [noPending], function* ({ startsFinding, renameOutput, finished }) {
	yield* startsFinding({ name: "Ready", role: "status" });

	yield* renameOutput("Ready");

	expect(yield* finished("find")).toBe("Loading");
});

eventScreen.it(
	"interrupting settlement releases the pending stream subscription",
	[pendingStream],
	function* ({ startsSettling, subscriptionState, cancelSettling }) {
		yield* startsSettling();
		expect(subscriptionState()).toBe("subscribed");

		yield* cancelSettling();

		expect(subscriptionState()).toBe("unsubscribed");
	},
);

for (const operation of ["findText", "gone"] as const) {
	eventScreen.it(
		`${operation} waits for idle pending work even when its DOM condition is met`,
		[pendingStream],
		function* ({ startsFindingText, startsGone, progress, complete, finished }) {
			if (operation === "findText") {
				yield* startsFindingText("Loading");
			} else {
				yield* startsGone("button");
			}
			expect(yield* progress(operation)).toBe("waiting");

			yield* complete();

			expect(yield* finished(operation)).toBe("succeeded");
		},
	);
}
