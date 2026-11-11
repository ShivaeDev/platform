import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { processes, twoServersAndWorker } from "#test/postgres-example/processKit.ts";

processes.it("every subscribed client receives its initial order", [twoServersAndWorker()], function* ({ initialHints }) {
	yield* outcomes([
		["a", () => initialHints("a"), ["result Printer paper"]],
		["another", () => initialHints("another"), ["result Printer paper"]],
		["b", () => initialHints("b"), ["result Printer paper"]],
	]);
});

for (const [writer, server] of [
	["a", "first"],
	["b", "second"],
] as const) {
	processes.it(
		`a commit through the ${server} server reaches subscribers on both servers`,
		[twoServersAndWorker()],
		function* ({ hintsSinceAction, order, saveFromServer }) {
			yield* saveFromServer(writer, `server ${server}`);

			yield* outcomes([
				["a hints", () => hintsSinceAction("a"), [`result server ${server}`]],
				["a reads", () => order("a"), `server ${server}`],
				["b hints", () => hintsSinceAction("b"), [`result server ${server}`]],
				["b reads", () => order("b"), `server ${server}`],
			]);
		},
		30_000,
	);
}

processes.it(
	"a commit from the pg-boss worker reaches subscribers on both servers",
	[twoServersAndWorker()],
	function* ({ hintsSinceAction, order, saveFromWorker }) {
		yield* saveFromWorker();

		yield* outcomes([
			["a hints", () => hintsSinceAction("a"), ["result worker"]],
			["a reads", () => order("a"), "worker"],
			["b hints", () => hintsSinceAction("b"), ["result worker"]],
			["b reads", () => order("b"), "worker"],
		]);
	},
	30_000,
);

processes.it(
	"a rolled-back write publishes no hint",
	[twoServersAndWorker()],
	function* ({ answers, hintsSinceAction, rejectWrite, saveFromServer }) {
		yield* rejectWrite();
		yield* saveFromServer("b", "after rollback");

		yield* outcomes([
			["a hints", () => hintsSinceAction("a"), ["result after rollback"]],
			["answers", () => answers(), ["rejected as Rejected", "saved"]],
			["b hints", () => hintsSinceAction("b"), ["result after rollback"]],
		]);
	},
	30_000,
);
