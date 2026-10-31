import { expect } from "vitest";
import { areaLanesProject } from "#test/areaLanesProject.ts";
import { host } from "#test/hostStory.ts";
import { refusal } from "#test/refusal.ts";

host.it("Fleet items show package holders and eligible priority queues with the scheduler's waiting reasons", [areaLanesProject], function* (daemon) {
	yield* daemon.approve("holder");
	yield* daemon.admit();

	const refused = { first: yield* refusal(daemon.fleetDispatch("first")), urgent: yield* refusal(daemon.fleetDispatch("urgent")) };

	const areas = (yield* daemon.fleetItems()).areas ?? [];
	expect({
		blockers: { first: (yield* daemon.storedRecord("first")).value.blocker, urgent: (yield* daemon.storedRecord("urgent")).value.blocker },
		free: areas.find(({ area }) => area === "free"),
		refused,
		workBoard: areas.find(({ area }) => area === "work-board"),
		workFleet: areas.find(({ area }) => area === "work-fleet"),
	}).toEqual({
		blockers: { first: "waiting for area work-fleet held by holder", urgent: "waiting for area work-fleet/host held by holder" },
		free: { area: "free", holders: [], queue: [] },
		refused: {
			first: "admission refused: waiting for area work-fleet held by holder",
			urgent: "admission refused: waiting for area work-fleet/host held by holder",
		},
		workBoard: { area: "work-board", holders: [], queue: [{ prUrl: null, stage: "queued", workId: "short" }] },
		workFleet: {
			area: "work-fleet",
			holders: [{ prUrl: null, stage: "working", workId: "holder" }],
			queue: [
				{ prUrl: null, stage: "waiting", workId: "urgent" },
				{ prUrl: null, stage: "waiting", workId: "first" },
			],
		},
	});
});
