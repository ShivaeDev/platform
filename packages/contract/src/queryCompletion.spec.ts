import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { completionStory, failed, held, refused, watching } from "#test/completionStory.ts";

completionStory.it(
	"an ordinary request signals completion after its value arrives over the socket",
	[],
	function* ({ open, requestFinished, shown, signals }) {
		open("ordinary");
		yield* requestFinished();

		yield* outcomes([
			["request", () => signals(), { completed: 1, pending: false, subscription: "disabled" }],
			["shown value", () => shown(), "First"],
		]);
	},
);

completionStory.it(
	"a failed request signals completion and preserves its declared failure",
	[failed],
	function* ({ open, requestFinished, shown, signals }) {
		open("ordinary");
		yield* requestFinished();

		yield* outcomes([
			["request", () => signals(), { completed: 1, pending: false }],
			["shown failure", () => shown(), "failed with read failed"],
		]);
	},
);

completionStory.it("the pushed subscription signals that the socket subscription opened", [], function* ({ open, signals, subscriptionAnswered }) {
	open("pushed");
	yield* subscriptionAnswered();

	expect(yield* signals()).toMatchObject({ subscription: "open" });
});

completionStory.it(
	"the pushed subscription signals refusal and exposes its policy denial",
	[refused],
	function* ({ open, requestFinished, shown, signals, subscriptionAnswered }) {
		open("pushed");
		yield* subscriptionAnswered();
		yield* requestFinished();

		yield* outcomes([
			["subscription", () => signals(), { pending: false, subscription: "refused" }],
			["shown denial", () => shown(), "failed with read denied"],
		]);
	},
);

for (const value of ["Second", "First"]) {
	completionStory.it(
		`the pushed refresh signals completion when its result ${value === "First" ? "equals" : "differs from"} the previous value`,
		[watching()],
		function* ({ announce, refreshed, shown, signals }) {
			expect(yield* shown()).toBe("First");
			const before = yield* signals();

			yield* announce(value);
			yield* refreshed();

			yield* outcomes([
				["completed refresh", () => signals(), { completed: before.completed + 1, pending: false }],
				["shown value", () => shown(), value],
			]);
		},
	);
}

completionStory.it(
	`a failed pushed refresh completes and exposes the handler's declared failure`,
	[watching()],
	function* ({ failRefresh, refreshed, shown, signals }) {
		expect(yield* shown()).toBe("First");
		const before = yield* signals();

		yield* failRefresh();
		yield* refreshed();

		yield* outcomes([
			["completed refresh", () => signals(), { completed: before.completed + 1, pending: false }],
			["shown failure", () => shown(), "failed with read failed"],
		]);
	},
);

completionStory.it(
	"a request stays pending until the socket delivers its held answer",
	[held],
	function* ({ open, releaseAnswer, requestFinished, requestReceived, shown, signals }) {
		open("ordinary");
		yield* requestReceived();
		expect(yield* signals()).toMatchObject({ completed: 0, pending: true });

		yield* releaseAnswer();
		yield* requestFinished();

		yield* outcomes([
			["completed request", () => signals(), { completed: 1, pending: false }],
			["shown value", () => shown(), "First"],
		]);
	},
);
