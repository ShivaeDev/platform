import { Effect } from "effect";
import { expect } from "vitest";
import { delayedRefresh } from "#test/hostCommandDelaysTraits.ts";
import { approvedWork, host, storedWork } from "#test/hostStory.ts";

host.it("stop cancels a preparing dispatch before a worker or Fleet record exists", [approvedWork(["one"]), delayedRefresh()], function* (daemon) {
	yield* daemon.request("daemon.dispatch", { workId: "one" });
	yield* daemon.awaitDelay();
	expect(yield* daemon.request("daemon.stop", { workId: "one" })).toEqual({
		releaseReason: "Work cancelled by orchestrator.",
		stage: "released",
		workId: "one",
	});
	expect(yield* daemon.request("daemon.dispatch-status", { workId: "one" })).toMatchObject({ status: "cancelled" });
	expect(daemon.readBoard(`responses/${daemon.responseFiles().at(-1)}`)).toContain("Work cancelled by orchestrator.");
	expect(daemon.boardAcknowledgements()).toMatchObject([{ disposition: "applied" }]);
	expect(yield* daemon.request("daemon.stop", { workId: "one" }).pipe(Effect.flip)).toMatchObject({ message: expect.stringContaining("released") });
	yield* daemon.releaseDelay();
	yield* daemon.stop();
	yield* daemon.start();
	yield* daemon.schedulerPass();
	expect(daemon.providerLaunches()).toEqual([]);
});

host.it("dropping a brief cancels its preparing dispatch without waiting for main", [approvedWork(["one"]), delayedRefresh()], function* (daemon) {
	yield* daemon.request("daemon.dispatch", { workId: "one" });
	yield* daemon.awaitDelay();
	daemon.writeBoard("one.md", daemon.readBoard("one.md").replace("kind: task", "kind: task\nstatus: dropped"));
	expect(yield* daemon.dispatchOutcome("one")).toMatchObject({ status: "cancelled" });
	yield* daemon.releaseDelay();
	expect(yield* daemon.awaitBoardResponse((source) => source.includes("Work cancelled because Board status is dropped."))).toContain(
		"Work cancelled because Board status is dropped.",
	);
	expect(daemon.providerLaunches()).toEqual([]);
});

host.it(
	"stop cancels a new preparation after an earlier run was released",
	[approvedWork(["one"]), storedWork("one", "released"), delayedRefresh()],
	function* (daemon) {
		yield* daemon.request("daemon.dispatch", { workId: "one" });
		yield* daemon.awaitDelay();
		expect(yield* daemon.request("daemon.stop", { workId: "one" })).toMatchObject({
			releaseReason: "Work cancelled by orchestrator.",
			stage: "released",
		});
		expect(yield* daemon.request("daemon.dispatch-status", { workId: "one" })).toMatchObject({ status: "cancelled" });
		yield* daemon.releaseDelay();
		yield* daemon.schedulerPass();
		expect(daemon.providerLaunches()).toEqual([]);
	},
);
