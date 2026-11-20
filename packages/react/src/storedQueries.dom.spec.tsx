import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { persisted, policy, recentQueries, signedIn, signedOutAnswer, storedOnDevice } from "#test/recent-queries/story.tsx";

recentQueries.it(
	"a reload shows the stored note in its first render, marked updating, then the subscription's result",
	[persisted, signedIn],
	function* ({ answer, firstShown, open, reload, shown, writeWindowPasses }) {
		yield* open();
		yield* answer("Alice's note");
		yield* writeWindowPasses();

		yield* reload();
		yield* open();

		yield* outcomes([
			["first render", firstShown, "Alice's note"],
			["shown note", shown, { stale: true, title: "Alice's note" }],
		]);

		yield* answer("Alice's fresh note");

		expect(yield* shown()).toEqual({ stale: false, title: "Alice's fresh note" });
	},
);

recentQueries.it(
	"a reloaded route loader commits from the stored note before the subscription answers",
	[storedOnDevice(["alice", "one", "Alice's stored note"]), signedIn],
	function* ({ answer, openRoute, shown }) {
		yield* openRoute();

		expect(yield* shown()).toEqual({ stale: true, title: "Alice's stored note" });

		yield* answer("Alice's fresh note");

		expect(yield* shown()).toEqual({ stale: false, title: "Alice's fresh note" });
	},
);

recentQueries.it(
	"a settled note is written once the write window passes",
	[persisted, signedIn],
	function* ({ answer, open, stored, writeWindowPasses }) {
		yield* open();
		yield* answer("Alice's note");

		expect(yield* stored()).toEqual({});

		yield* writeWindowPasses();

		expect(yield* stored()).toEqual({ alice: ["Alice's note"] });
	},
);

recentQueries.it(
	"hiding the page writes a settled note before the write window passes",
	[persisted, signedIn],
	function* ({ answer, open, pageHides, stored }) {
		yield* open();
		yield* answer("Alice's note");

		yield* pageHides();

		expect(yield* stored()).toEqual({ alice: ["Alice's note"] });
	},
);

recentQueries.it(
	"storage keeps the most recently settled notes up to the retention capacity",
	[policy({ capacity: 2 }), persisted, signedIn],
	function* ({ answer, leave, open, stored, writeWindowPasses }) {
		for (const id of ["one", "two", "three"]) {
			yield* open(id);
			yield* answer(`Note ${id}`);
			yield* leave();
		}

		yield* writeWindowPasses();

		expect(yield* stored()).toEqual({ alice: ["Note two", "Note three"] });
	},
);

recentQueries.it(
	"storage drops the least recently settled notes past its byte cap",
	[policy({ storedBytes: 60 }), persisted, signedIn],
	function* ({ answer, leave, open, stored, writeWindowPasses }) {
		for (const id of ["one", "two"]) {
			yield* open(id);
			yield* answer(`Note ${id}`);
			yield* leave();
		}

		yield* writeWindowPasses();

		expect(yield* stored()).toEqual({ alice: ["Note two"] });
	},
);

recentQueries.it(
	"a query whose result marks a field sensitive stays off the device while its neighbour is stored",
	[persisted, signedIn],
	function* ({ answer, leave, open, stored, writeWindowPasses }) {
		yield* open("secret");
		yield* answer("Alice's secret");
		yield* leave();
		yield* open("one");
		yield* answer("Alice's note");

		yield* writeWindowPasses();

		expect(yield* stored()).toEqual({ alice: ["Alice's note"] });
	},
);

for (const refusal of ["NotFound", "QueryReadDenied"] as const) {
	recentQueries.it(
		`a stored note whose subscription answers ${refusal} is deleted`,
		[storedOnDevice(["alice", "one", "Alice's stored note"], ["alice", "two", "Note two"]), signedIn],
		function* ({ open, refuse, stored, writeWindowPasses }) {
			yield* open();
			yield* refuse(refusal);

			yield* writeWindowPasses();

			expect(yield* stored()).toEqual({ alice: ["Note two"] });
		},
	);
}

recentQueries.it(
	"a stored note that no longer decodes is deleted and the screen loads empty",
	[storedOnDevice(["alice", "one", 42], ["alice", "two", "Note two"]), signedIn],
	function* ({ open, shown, stored, writeWindowPasses }) {
		yield* open("one");

		expect(yield* shown()).toEqual({ stale: false, title: "Loading" });

		yield* writeWindowPasses();

		expect(yield* stored()).toEqual({ alice: ["Note two"] });
	},
);

recentQueries.it("signing out wipes the stored notes", [storedOnDevice(["alice", "one", "Alice's note"]), signedIn], function* ({ session, stored }) {
	yield* session(undefined);

	expect(yield* stored()).toEqual({});
});

recentQueries.it(
	"bob signing in after alice wipes alice's stored notes and keeps his own",
	[storedOnDevice(["alice", "one", "Alice's note"], ["bob", "one", "Bob's note"]), signedIn],
	function* ({ open, session, shown, stored }) {
		yield* session("bob");
		yield* open();

		yield* outcomes([
			["stored notes", stored, { bob: ["Bob's note"] }],
			["shown note", shown, { stale: true, title: "Bob's note" }],
		]);
	},
);

recentQueries.it(
	"a launch whose session check answers signed out wipes the stored notes",
	[storedOnDevice(["alice", "one", "Alice's note"]), signedOutAnswer],
	function* ({ stored }) {
		expect(yield* stored()).toEqual({});
	},
);
