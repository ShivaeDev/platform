import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { comparedPostgres, stalledTransport } from "#test/compared-postgres/story.ts";

expectNoReactWarnings();

comparedPostgres.it(
	"a PostgreSQL repository commit pushes its compared result into the rendered query without a client read",
	[],
	function* ({ clientRequests, commit, displayed, reads, shown, sockets }) {
		expect(yield* shown()).toBe("Visible first");

		yield* commit(1, "Visible changed");
		yield* displayed("Visible changed");

		yield* outcomes([
			["rendered query", () => shown(), "Visible changed"],
			["server query executions", () => reads(), 2],
			["client requests", () => clientRequests(), ["compared.$changes"]],
			["screen sockets", () => sockets(), 1],
		]);
	},
);

for (const [description, id, title] of [
	["an equal result", 1, "Visible first"],
	["a filtered-out change", 2, "Hidden changed"],
] as const) {
	comparedPostgres.it(
		`${description} reruns PostgreSQL and acknowledges completion before a changed result reaches React`,
		[],
		function* ({ clientRequests, commit, displayed, reads, results, shown, untilReads }) {
			expect(yield* shown()).toBe("Visible first");

			yield* commit(id, title);
			yield* untilReads(2);
			yield* commit(1, "Visible changed");
			yield* displayed("Visible changed");

			yield* outcomes([
				["rendered query", () => shown(), "Visible changed"],
				["server query executions", () => reads(), 3],
				["client requests", () => clientRequests(), ["compared.$changes"]],
				[
					"socket deliveries",
					() => results(),
					[
						{ _tag: "Result", value: [{ title: "Visible first" }] },
						{ _tag: "Unchanged", queryIndex: 0 },
						{ _tag: "Result", value: [{ title: "Visible changed" }] },
					],
				],
			]);
		},
	);
}

comparedPostgres.it(
	"a socket stalled across 257 PostgreSQL commits reconciles React to the current compared result without a client read",
	[stalledTransport()],
	function* ({ clientRequests, commitRepeatedly, displayed, reads, results, resume, shown, sockets }) {
		expect(yield* shown()).toBe("Visible held");

		yield* commitRepeatedly(257);

		yield* outcomes([
			["stalled screen", () => shown(), "Visible held"],
			["server query executions before resume", () => reads(), 2],
		]);

		yield* resume();
		yield* displayed("Visible edit 257");

		yield* outcomes([
			["rendered query", () => shown(), "Visible edit 257"],
			["server query executions after resume", () => reads(), 3],
			["client requests", () => clientRequests(), ["compared.$changes"]],
			["screen sockets", () => sockets(), 1],
			[
				"socket deliveries",
				() => results(),
				[
					{ _tag: "Result", value: [{ title: "Visible first" }] },
					{ _tag: "Result", value: [{ title: "Visible held" }] },
					{ _tag: "Result", value: [{ title: "Visible edit 257" }] },
				],
			],
		]);
	},
);

comparedPostgres.it(
	"separate PostgreSQL commits during a held rerun cost two reruns and leave React on the final value",
	[],
	function* ({ clientRequests, commit, commitRepeatedly, displayed, holdNextRead, reads, releaseRerun, rerunStarted, shown }) {
		expect(yield* shown()).toBe("Visible first");
		yield* holdNextRead();

		yield* commit(1, "Visible in flight");
		yield* rerunStarted();
		yield* commitRepeatedly(20);
		yield* releaseRerun();
		yield* displayed("Visible edit 20");

		yield* outcomes([
			["final screen", () => shown(), "Visible edit 20"],
			["initial read plus two reruns", () => reads(), 3],
			["client requests", () => clientRequests(), ["compared.$changes"]],
		]);
	},
);

comparedPostgres.it(
	"access lost during a PostgreSQL burst denies React without running SQL or delivering private results",
	[],
	function* ({ clientRequests, commit, commitRepeatedly, denied, denyRead, holdPolicy, reads, releaseRerun, rerunStarted, resultValues, shown }) {
		expect(yield* shown()).toBe("Visible first");
		yield* holdPolicy();

		yield* commit(1, "Visible private");
		yield* rerunStarted();
		yield* denyRead();
		yield* commitRepeatedly(20);
		yield* releaseRerun();
		yield* denied();

		yield* outcomes([
			["denied screen", () => shown(), "Read denied"],
			["SQL executions", () => reads(), 1],
			["delivered values", () => resultValues(), [[{ title: "Visible first" }]]],
			["client requests", () => clientRequests(), ["compared.$changes"]],
		]);
	},
);

comparedPostgres.it(
	"another PostgreSQL subscription progresses while the first subscription's rerun is held",
	[],
	function* ({ commit, displayed, holdNextRead, independentShows, openIndependent, releaseRerun, rerunStarted, shown }) {
		yield* openIndependent();
		yield* holdNextRead();
		yield* commit(1, "Visible in flight");
		yield* rerunStarted();

		yield* commit(1, "Visible independent");
		yield* independentShows("Visible independent");

		expect(yield* shown()).toBe("Visible first");
		yield* releaseRerun();
		yield* displayed("Visible independent");
		expect(yield* shown()).toBe("Visible independent");
	},
);

comparedPostgres.it(
	"restoring access pushes the original PostgreSQL value again after a denial clears the stored hash",
	[],
	function* ({ allowRead, commit, denied, denyRead, displayed, resultValues, shown }) {
		expect(yield* shown()).toBe("Visible first");
		yield* denyRead();
		yield* commit(1, "Visible private");
		yield* denied();
		expect(yield* shown()).toBe("Read denied");

		yield* allowRead();
		yield* commit(1, "Visible first");
		yield* displayed("Visible first");

		yield* outcomes([
			["restored screen", () => shown(), "Visible first"],
			["delivered values", () => resultValues(), [[{ title: "Visible first" }], [{ title: "Visible first" }]]],
		]);
	},
);
