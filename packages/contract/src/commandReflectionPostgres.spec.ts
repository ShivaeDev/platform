import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { reflectedPostgres, watching } from "#test/reflectedPostgres.ts";

reflectedPostgres.it(
	"a command's sync token crosses PostgreSQL behind its keys, so the command is reflected only once its write is on the screen",
	[watching()],
	function* ({ activity, beginStamp, finished, holdReads, releaseReads, shown, signals, untilAccepted, untilReadBegins }) {
		yield* holdReads();
		yield* beginStamp("Second");
		yield* untilAccepted();
		yield* untilReadBegins();

		yield* outcomes([
			["signals", () => signals(), ["sent", "accepted"]],
			["shown", () => shown(), "First"],
			["activity", () => activity(), "1 not yet reflected"],
		]);

		yield* releaseReads();

		yield* outcomes([
			["command", () => finished(), "reflected"],
			["shown", () => shown(), "First, Second"],
			["activity", () => activity(), "settled"],
		]);
	},
);

reflectedPostgres.it(
	"a command that commits several transactions is reflected after the last one's update",
	[watching()],
	function* ({ add, shown }) {
		yield* outcomes([
			["command", () => add("Second", "Third"), "reflected"],
			["shown", () => shown(), "First, Second, Third"],
		]);
	},
);

reflectedPostgres.it("a command that publishes nothing is reflected over PostgreSQL", [watching()], function* ({ signals, touch }) {
	yield* outcomes([
		["command", () => touch(), "reflected"],
		["signals", () => signals(), ["sent", "accepted", "reflected"]],
	]);
});

reflectedPostgres.it(
	"a command whose transaction rolls back leaves nothing to wait for",
	[watching()],
	function* ({ activity, addRefused, shown, signals, touch }) {
		expect(yield* addRefused("Second")).toBe("failed with conflict: Second is refused");

		yield* outcomes([
			["signals", () => signals(), ["sent"]],
			["activity", () => activity(), "settled"],
		]);

		yield* touch();

		expect(yield* shown()).toBe("First");
	},
);

reflectedPostgres.it(
	"a sync waits for a write committed through another host",
	[watching()],
	function* ({ beginSync, finished, holdReads, otherHostAdds, releaseReads, shown, signals, untilAccepted, untilReadBegins }) {
		yield* holdReads();
		yield* otherHostAdds("Second");
		yield* untilReadBegins();
		yield* beginSync();
		yield* untilAccepted();

		yield* outcomes([
			["signals", () => signals(), ["sent", "accepted"]],
			["shown", () => shown(), "First"],
		]);

		yield* releaseReads();

		yield* outcomes([
			["command", () => finished(), "reflected"],
			["shown", () => shown(), "First, Second"],
		]);
	},
);
