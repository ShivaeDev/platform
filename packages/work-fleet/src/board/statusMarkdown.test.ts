import { expect } from "vitest";
import { boardOf } from "@shivaedev/work-board/server/render/board.ts";
import { boardFileStory } from "#test/boardFileStory.ts";
import { statusRecord } from "#test/status.ts";

boardFileStory.it("groups every waiting owner separately with one card per current work item", [], function* ({ status }) {
	const active = statusRecord("task.active");
	const human = {
		attentionOwner: "maintainer" as const,
		...statusRecord("task.human", "waiting"),
		decision: { id: "synthetic-decision", links: [], reason: "Delivery needs approval", recommendation: "Inspect delivery" },
		result: { head: "synthetic-head", kind: "change", paths: [], pr: "https://example.test/pull/1" } as const,
	};
	const done = statusRecord("task.done", "done");
	const routine = statusRecord("task.routine", "waiting");
	const automation = {
		...statusRecord("task.automation", "validating"),
		checks: { evidence: [], head: "synthetic-head", passed: false, pending: true },
	};
	yield* status.publish([done, human, routine, automation, statusRecord("task.released", "released"), active]);
	const source = status.read();
	const board = boardOf(source);
	expect(board.sections.map(({ title }) => title)).toEqual(["Active", "Waiting on you", "Waiting on orchestrator", "Waiting on automation", "Done"]);
	expect(board.sections.map(({ items }) => items.length)).toEqual([1, 1, 1, 1, 1]);
	expect(board.sections[2]?.items[0]).toContain("task.routine");
	expect(board.sections[3]?.items[0]).toContain("task.automation");
	expect(board.sections[0]?.items[0]).toContain("[Task](</_board/item/task.active>)");
	expect(board.sections[1]?.items[0]).toContain("[PR](<https://example.test/pull/1>)");
	expect(board.sections[1]?.items[0]).toContain("Delivery needs approval");
	expect(source).not.toContain("task.released");
	expect(source).not.toContain(active.prompt);
	expect(source).not.toContain(active.cwd);
	yield* status.publish([human, active, done, automation, routine]);
	expect(status.read()).toBe(source);
});

boardFileStory.it("keeps empty columns and treats identities, blockers and unsafe PR links as data", [], function* ({ status }) {
	const workId = "task.[odd]\n## Injected";
	yield* status.publish([
		{
			...statusRecord(workId),
			blocker: "<script>\n### Extra card",
			result: { head: "synthetic-head", kind: "change", paths: [], pr: "javascript:alert(1)" },
		},
	]);
	const source = status.read();
	const board = boardOf(source);
	expect(board.sections.map(({ title }) => title)).toEqual(["Active", "Waiting on you", "Waiting on orchestrator", "Waiting on automation", "Done"]);
	expect(board.sections.map(({ items }) => items.length)).toEqual([0, 0, 1, 0, 0]);
	expect(source).toContain(encodeURIComponent(workId));
	expect(source).not.toContain("<script>");
	expect(source).not.toContain("javascript:");
});
