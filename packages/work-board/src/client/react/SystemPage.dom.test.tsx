import { expect } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { systemScreen } from "#test/screenTraits.ts";
import { todayFleetFixture } from "#test/todayFleetFixture.ts";

const fleet = todayFleetFixture();
if (fleet.state !== "ready" || !fleet.items[0]) {
	throw new Error("Missing Fleet fixture");
}

screenStory.it(
	"System lists Fleet's queued, running and waiting work by title, stage and pull request, and leaves released work out",
	[
		systemScreen({
			...fleet,
			items: fleet.items.map((item) => (item.stage === "waiting" ? { ...item, attentionOwner: "maintainer" as const } : item)),
		}),
	],
	function* ({ fleetWorkLane }) {
		const lane = yield* fleetWorkLane();
		expect(lane).toEqual(
			expect.objectContaining({
				rows: expect.arrayContaining([
					expect.objectContaining({
						id: "task.sample.0",
						pr: "https://github.com/example/project/pull/1",
						stage: "Working",
						title: "Workspace task 0",
					}),
					expect.objectContaining({ id: "task.sample.1", stage: "Reviewing" }),
					expect.objectContaining({ id: "task.queued", stage: "Queued" }),
					expect.objectContaining({ id: "task.waiting", stage: "Waiting", text: expect.stringContaining("Waiting on you") }),
				]),
			}),
		);
		expect(lane).not.toEqual(expect.objectContaining({ rows: expect.arrayContaining([expect.objectContaining({ id: "task.released" })]) }));
	},
);

const { prUrl, ...withoutPullRequest } = fleet.items[0];
screenStory.it(
	"System keeps a Fleet row without a pull request with only its title link",
	[systemScreen({ ...fleet, items: [withoutPullRequest] })],
	function* ({ fleetWorkLane }) {
		expect(yield* fleetWorkLane()).toEqual(
			expect.objectContaining({
				rows: [expect.objectContaining({ id: "task.sample.0", links: 1, pr: "none", stage: "Working", title: "Workspace task 0" })],
			}),
		);
	},
);

for (const [name, data, expected] of [
	["still loading", undefined, { loading: "shown", message: "none", rows: [] }],
	[
		"unavailable",
		{ reason: "Daemon disconnected", state: "unavailable" } as const,
		{ loading: "none", message: "Fleet work unavailable. Daemon disconnected", rows: [] },
	],
	["empty", { completed: [], items: [], state: "ready" } as const, { loading: "none", message: "No Fleet work", rows: [] }],
] as const) {
	screenStory.it(`System's Fleet work list tells ${name} Fleet data apart`, [systemScreen(data)], function* ({ fleetWorkLane }) {
		expect(yield* fleetWorkLane()).toEqual(expected);
	});
}
