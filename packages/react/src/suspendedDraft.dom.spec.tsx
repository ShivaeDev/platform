import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { suspended, suspendedDraft } from "#test/suspendedStories.ts";

suspended.it(
	"a suspending session transition keeps the visible draft and its stored copy",
	[suspendedDraft("typed")],
	function* ({ loading, name, stored, suspendingTransition, suspensions }) {
		yield* suspendingTransition("second");

		yield* outcomes({
			loading: [loading(), "not shown"],
			name: [name(), "Visible draft"],
			stored: [stored(), "Visible draft"],
			suspensions: [suspensions(), "suspended"],
		});
	},
);

suspended.it(
	"returning from a canceled transition keeps the first session's form",
	[suspendedDraft("transition canceled")],
	function* ({ firstSessionForm, session }) {
		yield* session("first");

		expect(yield* firstSessionForm()).toBe("same form");
	},
);

suspended.it("the first session keeps storing its draft after a canceled transition", [suspendedDraft("returned")], function* ({ stored, type }) {
	yield* type("Continued editing");

	expect(yield* stored()).toBe("Continued editing");
});

suspended.it(
	"a completed switch after a canceled transition drops the first session's draft",
	[suspendedDraft("continued")],
	function* ({ session, stored }) {
		yield* session("second");

		expect(yield* stored()).toBe("none");
	},
);

suspended.it(
	"a late edit from the first session's form leaves the second session's draft alone",
	[suspendedDraft("second typed")],
	function* ({ firstFormEdits, stored }) {
		yield* firstFormEdits("Late old edit");

		expect(yield* stored()).toBe("New session");
	},
);

suspended.it(
	"a session replaced inside hidden Activity drops the old session's draft",
	[suspendedDraft("hidden")],
	function* ({ hiddenSession, stored }) {
		yield* hiddenSession("second");

		expect(yield* stored()).toBe("none");
	},
);

suspended.it("revealing the replacing session shows a fresh form", [suspendedDraft("replaced while hidden")], function* ({ name, session }) {
	yield* session("second");

	expect(yield* name()).toBe("Paper");
});

suspended.it("the revealed session stores its own draft", [suspendedDraft("revealed")], function* ({ stored, type }) {
	yield* type("Revealed draft");

	expect(yield* stored()).toBe("Revealed draft");
});
