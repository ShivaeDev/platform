import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { fleetDaemon } from "#test/daemonStory.ts";
import { storedWork } from "#test/hostStory.ts";
import { statusRecord } from "#test/status.ts";

fleetDaemon.it("a change-listener resync rereads committed state after a missed hint", [storedWork("one", "working")], function* (daemon) {
	yield* daemon.subscribe(["one"]);
	yield* daemon.commitWithoutHint(statusRecord("one", "done"));
	yield* Effect.sleep("100 millis");
	expect(daemon.snapshots()).toMatchObject([[{ stage: "working", workId: "one" }]]);
	yield* daemon.resync();
	yield* daemon.awaitSnapshots(2);
	expect(daemon.snapshots()).toMatchObject([[{ stage: "working", workId: "one" }], [{ stage: "done", workId: "one" }]]);
});
