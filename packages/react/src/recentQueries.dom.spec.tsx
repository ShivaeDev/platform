import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { policy, recentQueries, signedIn } from "#test/recent-queries/story.tsx";

for (const source of ["screen", "loader"] as const) {
	recentQueries.it(
		`${source}: returning within five minutes shows stale data immediately, then the subscription's fresh result`,
		[signedIn],
		function* ({ answer, leave, open, pass, reads, shown, startLoader, untilRetained }) {
			if (source === "screen") {
				yield* open();
			} else {
				yield* startLoader();
			}
			yield* answer("Alice's original note");
			if (source === "screen") {
				yield* leave();
			}
			yield* untilRetained();
			yield* pass("4 minutes");

			yield* open();

			expect(yield* shown()).toEqual({ stale: true, title: "Alice's original note" });

			yield* answer("Alice's fresh note");

			yield* outcomes([
				["shown note", shown, { stale: false, title: "Alice's fresh note" }],
				["subscription reads", reads, ["one", "one"]],
			]);
		},
	);
}

for (const options of [{}, { timeToLive: "2 seconds" }] as const) {
	recentQueries.it(
		`returning after ${options.timeToLive ?? "five minutes"} starts with an empty load`,
		[policy(options), signedIn],
		function* ({ answer, leave, open, pass, shown, untilRetained }) {
			yield* open();
			yield* answer("Expired note");
			yield* leave();
			yield* untilRetained();
			yield* pass(options.timeToLive ?? "5 minutes");

			yield* open();

			expect(yield* shown()).toEqual({ stale: false, title: "Loading" });

			yield* answer("Current note");

			expect(yield* shown()).toEqual({ stale: false, title: "Current note" });
		},
	);
}

for (const signedOut of [false, true]) {
	recentQueries.it(
		`${signedOut ? "signing out, then in" : "switching directly"} as bob discards alice's retained data`,
		[signedIn],
		function* ({ answer, leave, open, session, shown, untilRetained }) {
			yield* open();
			yield* answer("Alice's private note");
			expect((yield* shown()).title).toBe("Alice's private note");
			yield* leave();
			yield* untilRetained();
			if (signedOut) {
				yield* session(undefined);
			}

			yield* session("bob");
			yield* open();

			expect(yield* shown()).toEqual({ stale: false, title: "Loading" });

			yield* answer("Bob's private note");

			expect(yield* shown()).toEqual({ stale: false, title: "Bob's private note" });
		},
	);
}

recentQueries.it(
	"exceeding the idle query limit evicts the oldest query and keeps a recent query",
	[policy({ capacity: 2 }), signedIn],
	function* ({ answer, leave, open, shown }) {
		for (const id of ["one", "two", "three"]) {
			yield* open(id);
			yield* answer(`Note ${id}`);
			yield* leave();
		}

		yield* open("one");

		expect(yield* shown()).toEqual({ stale: false, title: "Loading" });

		yield* answer("New note one");
		yield* leave();
		yield* open("three");

		expect(yield* shown()).toEqual({ stale: true, title: "Note three" });
	},
);

for (const options of [{ capacity: 0 }, { timeToLive: 0 }]) {
	recentQueries.it(
		`disabling retention with ${JSON.stringify(options)} starts each visit empty`,
		[policy(options), signedIn],
		function* ({ answer, leave, open, shown }) {
			yield* open();
			yield* answer("Unkept note");
			yield* leave();

			yield* open();

			expect(yield* shown()).toEqual({ stale: false, title: "Loading" });
		},
	);
}

recentQueries.it(
	"reopening cancels the old expiry and leaving again starts a new window",
	[signedIn],
	function* ({ answer, leave, open, pass, shown, untilRetained }) {
		yield* open();
		yield* answer("First note");
		yield* leave();
		yield* untilRetained();
		yield* pass("4 minutes");
		yield* open();
		yield* answer("Fresh note");
		yield* pass("2 minutes");
		yield* leave();
		yield* untilRetained();

		yield* open();

		expect(yield* shown()).toEqual({ stale: true, title: "Fresh note" });
	},
);
