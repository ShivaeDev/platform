import { expect } from "vitest";
import { activityPage } from "#test/activityPage.ts";

activityPage.it("a read after saving shows the saved title without polling", [], function* ({ shown, enter, click, find }) {
	expect(yield* shown()).toBe("First page");
	yield* enter("input", "Saved page");

	yield* click({ name: "Save", role: "button" });

	const output = yield* find("output");
	expect(output.textContent).toBe("Saved page");
});

activityPage.it(
	"the next live hint arrives after another viewer writes and coalesced reads show its title",
	[],
	function* ({ shown, startHintWait, writeElsewhere }) {
		expect(yield* shown()).toBe("First page");
		const hint = yield* startHintWait();
		expect(yield* hint.state).toBe("waiting");

		yield* writeElsewhere("Another viewer's page");
		yield* hint.finish;

		expect(yield* hint.state).toBe("received");
		expect(yield* shown()).toBe("Another viewer's page");
	},
);

activityPage.it(
	"the driver stays unsettled while a live refresh is running",
	[],
	function* ({ shown, holdRefresh, startHintWait, writeElsewhere, refreshStarted, startSettling, releaseRefresh, activity }) {
		expect(yield* shown()).toBe("First page");
		yield* holdRefresh();
		const hint = yield* startHintWait();
		yield* writeElsewhere("Refreshed page");
		yield* hint.finish;
		yield* refreshStarted();

		const settling = yield* startSettling();
		expect(yield* settling.state).toBe("waiting");
		expect((yield* activity()).refreshingAtoms).toBeGreaterThan(0);
		yield* releaseRefresh();
		yield* settling.finish;

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

activityPage.it(
	"unmounting clears a queued live invalidation",
	[],
	function* ({ shown, coalesceFor, startHintWait, writeElsewhere, activity, closePage }) {
		expect(yield* shown()).toBe("First page");
		yield* coalesceFor("1 hour");
		const hint = yield* startHintWait();
		yield* writeElsewhere("Queued page");
		yield* hint.finish;
		expect(yield* activity()).toMatchObject({ liveInvalidations: 1 });

		yield* closePage();

		expect((yield* activity()).liveInvalidations).toBe(0);
	},
);

activityPage.it(
	"unmounting a screen releases its held query activity",
	[],
	function* ({ shown, holdRefresh, startHintWait, writeElsewhere, refreshStarted, activity, closePage, settle }) {
		expect(yield* shown()).toBe("First page");
		yield* holdRefresh();
		const hint = yield* startHintWait();
		yield* writeElsewhere("Held page");
		yield* hint.finish;
		yield* refreshStarted();
		expect(yield* activity()).toMatchObject({ refreshingAtoms: 1, rpcCalls: 1 });

		yield* closePage();
		yield* settle();

		expect(yield* activity()).toMatchObject({ refreshingAtoms: 0, rpcCalls: 0 });
	},
);
