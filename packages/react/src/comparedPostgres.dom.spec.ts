import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
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
		`${description} reruns PostgreSQL without a delivery before a changed result reaches React`,
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
