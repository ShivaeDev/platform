import { expect } from "vitest";
import { activityPage } from "#test/activityPage.ts";

activityPage.it("a read after saving shows the saved title without polling", [], function* ({ shown, enter, click, findTitle }) {
	expect(yield* shown()).toBe("First page");
	yield* enter("input", "Saved page");

	yield* click({ name: "Save", role: "button" });
	yield* findTitle("Saved page");

	expect(yield* shown()).toBe("Saved page");
});

activityPage.it(
	"the next pushed update arrives after another viewer writes and shows its title",
	[],
	function* ({ shown, findTitle, writeElsewhere }) {
		expect(yield* shown()).toBe("First page");

		yield* writeElsewhere("Another viewer's page");
		yield* findTitle("Another viewer's page");

		expect(yield* shown()).toBe("Another viewer's page");
	},
);

activityPage.it(
	"a held server rerun leaves the screen readable until its pushed value arrives",
	[],
	function* ({ shown, holdRefresh, findTitle, writeElsewhere, refreshStarted, releaseRefresh, activity }) {
		expect(yield* shown()).toBe("First page");
		yield* holdRefresh();
		yield* writeElsewhere("Refreshed page");
		yield* refreshStarted();

		expect(yield* shown()).toBe("First page");
		expect(yield* activity()).toMatchObject({ refreshingAtoms: 0, rpcCalls: 0 });

		yield* releaseRefresh();
		yield* findTitle("Refreshed page");
		expect(yield* shown()).toBe("Refreshed page");
	},
);

activityPage.it(
	"finite calls return to idle after success, rejection and interruption while the live stream stays open",
	[],
	function* ({ shown, activity, readMissing, holdRefresh, startRead, refreshStarted, settle }) {
		expect(yield* shown()).toBe("First page");
		expect((yield* activity()).rpcCalls).toBe(0);
		expect(yield* readMissing()).toBe("Missing");
		expect((yield* activity()).rpcCalls).toBe(0);
		yield* holdRefresh();
		const read = yield* startRead();
		yield* refreshStarted();
		expect(yield* activity()).toMatchObject({ rpcCalls: 1 });

		yield* read.cancel;
		yield* settle();

		expect((yield* activity()).rpcCalls).toBe(0);
	},
);
