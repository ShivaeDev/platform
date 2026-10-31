import { Effect } from "effect";
import { expect } from "vitest";
import { areaLanesProject } from "#test/areaLanesProject.ts";
import { host } from "#test/hostStory.ts";

host.it("Fleet exposes package holders and eligible priority queues with the scheduler's waiting reasons", [areaLanesProject], function* (daemon) {
	yield* daemon.approve("holder");
	yield* daemon.admit();
	for (const id of ["first", "urgent"]) {
		yield* daemon.fleetDispatch(id).pipe(Effect.result);
	}
	const result = yield* daemon.fleetItems();
	const fleetArea = result.areas?.find((area) => area.area === "work-fleet");
	expect(fleetArea).toEqual({
		area: "work-fleet",
		holders: [{ prUrl: null, stage: "working", workId: "holder" }],
		queue: [
			{ prUrl: null, stage: "waiting", workId: "urgent" },
			{ prUrl: null, stage: "waiting", workId: "first" },
		],
	});
	expect(result.areas?.find((area) => area.area === "work-board")).toEqual({
		area: "work-board",
		holders: [],
		queue: [{ prUrl: null, stage: "queued", workId: "short" }],
	});
	expect(result.areas?.find((area) => area.area === "free")).toEqual({ area: "free", holders: [], queue: [] });
	for (const id of ["first", "urgent"]) {
		expect((yield* daemon.storedRecord(id)).value.blocker).toBe(
			`waiting for area ${id === "urgent" ? "work-fleet/host" : "work-fleet"} held by holder`,
		);
	}
});
