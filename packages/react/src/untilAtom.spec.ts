import { expect } from "vitest";
import { atomStory, firstReadPublishes } from "#test/atomStories.ts";

atomStory.it("resolves with an atom's matching current value", [], function* ({ waitFor }) {
	const value = yield* waitFor("waiting");

	expect(value).toBe("waiting");
});

atomStory.it("resolves with a later matching value after ignoring other updates", [], function* ({ beginWaitingFor, publish, waitedValue }) {
	yield* beginWaitingFor("ready");

	yield* publish("still waiting");
	yield* publish("ready");
	yield* publish("later");

	expect(yield* waitedValue()).toBe("ready");
});

atomStory.it(
	"subscribes before the first read so a transient matching value is received",
	[firstReadPublishes("waiting", "ready")],
	function* ({ waitFor }) {
		const value = yield* waitFor("ready");

		expect(value).toBe("ready");
	},
);

atomStory.it("a missing match fails with the signal name, last atom value and help", [], function* ({ failure }) {
	const message = yield* failure("ready");

	expect(message).toBe(
		'Signal "atom holding ready" never arrived: the live-time deadline expired.\nLast value seen: waiting\nhelp: Check that the action emits this signal and that the predicate matches its expected value.',
	);
});

atomStory.it("a failed atom wait releases its subscription", [], function* ({ failure, subscribed }) {
	yield* failure("ready");

	expect(yield* subscribed()).toBe(false);
});

atomStory.it("a completed atom wait releases its subscription", [], function* ({ waitFor, subscribed }) {
	yield* waitFor("waiting");

	expect(yield* subscribed()).toBe(false);
});

atomStory.it("interrupting an atom wait releases its subscription", [], function* ({ beginWaitingFor, interruptWait, subscribed }) {
	yield* beginWaitingFor("ready");
	expect(yield* subscribed()).toBe(true);

	yield* interruptWait();

	expect(yield* subscribed()).toBe(false);
});
