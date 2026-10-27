import { Effect } from "effect";
import { expect } from "vitest";
import { delayedRefresh } from "#test/hostCommandDelaysTraits.ts";
import { approvedWork, host } from "#test/hostStory.ts";

host.it("stop cancels a preparing dispatch before a worker or Fleet record exists", [approvedWork(["one"]), delayedRefresh()], function* (daemon) {
	yield* daemon.request("daemon.dispatch", { workId: "one" });
	yield* daemon.awaitDelay();
	expect(yield* daemon.cli(["stop", "one"], { selection: "port" })).toEqual({
		code: 0,
		stderr: "",
		stdout: "one released: Work cancelled by orchestrator.",
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
