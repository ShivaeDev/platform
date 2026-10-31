import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import type { FleetRecord } from "#model.ts";
import { boardFileStory } from "#test/boardFileStory.ts";
import { statusRecord } from "#test/status.ts";

const ACTIVE = statusRecord("task.active");
const MAINTAINER: FleetRecord = {
	attentionOwner: "maintainer",
	...statusRecord("task.human", "waiting"),
	decision: { id: "synthetic-decision", links: [], reason: "Delivery needs approval", recommendation: "Inspect delivery" },
	result: { head: "synthetic-head", kind: "change", paths: [], pr: "https://example.test/pull/1" },
};
const ROUTINE = statusRecord("task.routine", "waiting");
const AUTOMATION: FleetRecord = {
	...statusRecord("task.automation", "validating"),
	checks: { evidence: [], head: "synthetic-head", passed: false, pending: true },
};
const DONE = statusRecord("task.done", "done");
const RELEASED = statusRecord("task.released", "released");
const COLUMNS = ["Active", "Waiting on you", "Waiting on orchestrator", "Waiting on automation", "Done"];

boardFileStory.it("status cards are grouped by waiting owner, one card per current work item and none for released work", [], function* ({ status }) {
	yield* status.publish([DONE, MAINTAINER, ROUTINE, AUTOMATION, RELEASED, ACTIVE]);

	expect(yield* status.sections()).toEqual([
		{ cards: [expect.stringContaining("task.active")], title: "Active" },
		{ cards: [expect.stringContaining("task.human")], title: "Waiting on you" },
		{ cards: [expect.stringContaining("task.routine")], title: "Waiting on orchestrator" },
		{ cards: [expect.stringContaining("task.automation")], title: "Waiting on automation" },
		{ cards: [expect.stringContaining("task.done")], title: "Done" },
	]);
});

boardFileStory.it("an active card links its task and a maintainer card links its PR with the decision reason", [], function* ({ status }) {
	yield* status.publish([MAINTAINER, ACTIVE]);

	yield* outcomes([
		["active card", () => status.card("Active"), expect.stringContaining("[Task](</_board/item/task.active>)")],
		["maintainer card link", () => status.card("Waiting on you"), expect.stringContaining("[PR](<https://example.test/pull/1>)")],
		["maintainer card reason", () => status.card("Waiting on you"), expect.stringContaining("Delivery needs approval")],
	]);
});

boardFileStory.it("status leaves out the worker prompt and checkout path", [], function* ({ status }) {
	yield* status.publish([ACTIVE]);

	yield* outcomes([
		["prompt", () => status.published(), expect.not.stringContaining(ACTIVE.prompt)],
		["checkout path", () => status.published(), expect.not.stringContaining(ACTIVE.cwd)],
	]);
});

boardFileStory.it("status is the same whatever order the records arrive in", [], function* ({ status }) {
	yield* status.publish([DONE, MAINTAINER, ROUTINE, AUTOMATION, ACTIVE]);
	const first = yield* status.published();

	yield* status.publish([MAINTAINER, ACTIVE, DONE, AUTOMATION, ROUTINE]);

	expect(yield* status.published()).toBe(first);
});

boardFileStory.it("status keeps every column when only one holds a card", [], function* ({ status }) {
	yield* status.publish([ROUTINE]);

	expect((yield* status.sections()).map(({ cards, title }) => `${title}: ${cards.length}`)).toEqual(
		COLUMNS.map((title) => `${title}: ${title === "Waiting on orchestrator" ? 1 : 0}`),
	);
});

boardFileStory.it("an odd work id, a script blocker and a javascript PR link are written as inert data", [], function* ({ status }) {
	const workId = "task.[odd]\n## Injected";

	yield* status.publish([
		{
			...statusRecord(workId),
			blocker: "<script>\n### Extra card",
			result: { head: "synthetic-head", kind: "change", paths: [], pr: "javascript:alert(1)" },
		},
	]);

	yield* outcomes([
		["encoded work id", () => status.published(), expect.stringContaining(encodeURIComponent(workId))],
		["script tag", () => status.published(), expect.not.stringContaining("<script>")],
		["javascript link", () => status.published(), expect.not.stringContaining("javascript:")],
		["cards", () => status.sections().pipe(Effect.map((sections) => sections.flatMap(({ cards }) => cards).length)), 1],
	]);
});
