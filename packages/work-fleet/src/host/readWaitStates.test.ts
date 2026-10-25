import { expect } from "@effect/vitest";
import type { FleetCycleSnapshot } from "#model.ts";
import { host } from "#test/hostStory.ts";
import { prepared } from "#test/preparation.ts";

host.it("100 items read in one query per poll without execution history", [], function* (daemon) {
	const history = [
		{
			archivedAt: 1,
			attempts: [],
			boardRevision: "old",
			cwd: "/synthetic",
			preparation: prepared(),
			prompt: "x".repeat(100_000),
			stage: "done",
			step: "done",
		},
	] satisfies readonly FleetCycleSnapshot[];
	const ids = Array.from({ length: 100 }, (_, index) => `item-${index}`);
	for (const id of ids) {
		yield* daemon.store(id, { history, stage: "working", step: "working" });
	}
	for (let poll = 0; poll < 2; poll += 1) {
		const { states, statements } = yield* daemon.tracedSummaries(ids);
		expect(states).toHaveLength(100);
		expect(states[0]).toEqual({ outcome: {}, stage: "working", workId: "item-0" });
		expect(statements).toHaveLength(1);
		expect(statements[0]).not.toContain('"history"');
	}
});
host.it("waiting summaries retain a stable code beside reworded reason text", [], function* (daemon) {
	const decision = { attentionOwner: "maintainer", code: "reviewed-pr-ready", reason: "A human can merge this reviewed change now." };
	yield* daemon.store("one", { decision, stage: "waiting", step: "waiting" });
	expect(yield* daemon.summaries(["one"])).toEqual([
		{ attentionOwner: "maintainer", blocker: decision.reason, decision, outcome: {}, stage: "waiting", workId: "one" },
	]);
});
