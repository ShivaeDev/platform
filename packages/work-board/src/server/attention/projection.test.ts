import { Effect } from "effect";
import { expect } from "vitest";
import { attention } from "#server/integration/attention.ts";
import { inboxCount } from "#server/navigation/model.ts";
import { projectionQueries } from "#server/views/projectionQueries.ts";
import { attentionLanesFixture } from "#test/attentionLanesFixture.ts";
import { boardStory } from "#test/boardStory.ts";
import { responseRecords } from "#test/responseRecords.ts";
import { anInbox } from "#test/storyTraits.ts";
import { attentionProjection } from "./projection.ts";

boardStory.it("partitions asks and reports source diagnostics separately with one count for all queries", [anInbox()], function* ({ readAttention }) {
	const snapshot = { ...(yield* readAttention(attentionLanesFixture("Casey"))), maintainer: "Casey" };
	const projection = attention.projection(snapshot);
	expect(projection.you.map((item) => item.id)).toEqual(["decision.reader", "question.storage", "task.person"]);
	expect(projection.agents.map((item) => item.id)).toEqual(["task.planned", "decision.orchestrator", "decision.automation"]);
	expect(projection.agents.map((item) => item.responseFrom)).toEqual([["maintainer"], ["orchestrator"], ["automation"]]);
	expect(projection.resolved.map((item) => item.id)).toEqual(["task.done", "task.done", "task.done", "task.superseded"]);
	expect(projection.parked.map((item) => item.id)).toEqual(["task.deferred"]);
	expect(projection.issues.map((issue) => issue.file)).toEqual(["unknown.md", "unresolved.md"]);
	const queries = projectionQueries({ document: undefined, index: Effect.succeed(snapshot) });
	const inbox = yield* queries.inbox();
	expect([inbox.you.length, inboxCount(snapshot)]).toEqual([3, 3]);
	expect(inbox).toEqual(projection);
});

boardStory.it("includes unregistered asks and isolates audiences when they share a target", [anInbox()], function* ({ readAttention }) {
	const files = attentionLanesFixture();
	files["reader.md"] = files["reader.md"]?.replace("managed: true", "managed: false").replace("[maintainer]", "[orchestrator, maintainer]") ?? "";
	files["orchestrator.md"] = files["orchestrator.md"]?.replace("unblocks: [decision.orchestrator]", "unblocks: [decision.reader]") ?? "";
	const data = attentionProjection(yield* readAttention(files));
	expect(data.you.map((item) => item.id)).toEqual(["task.planned", "decision.reader", "question.storage", "task.person"]);
	expect(data.agents.map((item) => item.responseFrom)).toEqual([["orchestrator"], ["automation"]]);
	expect(data.agents[0]?.id).toBe("decision.reader");
});

boardStory.it("withholds all lanes and the badge when the workspace is incomplete", [anInbox()], function* ({ readAttention }) {
	const snapshot = yield* readAttention(attentionLanesFixture(), ["unreadable.md"]);
	const data = attentionProjection(snapshot);
	expect(data.complete).toBe(false);
	expect([data.you, data.agents, data.resolved, data.parked]).toEqual([[], [], [], []]);
	expect(inboxCount(snapshot)).toBeNull();
});

boardStory.it("preserves a person's next action when an agent request targets the same item", [anInbox()], function* ({ readAttention }) {
	const files = attentionLanesFixture();
	files["orchestrator.md"] = files["orchestrator.md"]?.replace("unblocks: [decision.orchestrator]", "unblocks: [task.person]") ?? "";
	const data = attentionProjection(yield* readAttention(files));
	expect(data.you.find((item) => item.id === "task.person")?.reason).toBe("Casey: Read the evidence");
	expect(data.agents.find((item) => item.id === "task.person")?.responseFrom).toEqual(["orchestrator"]);
});

for (const audience of ["reader", "orchestrator"]) {
	boardStory.it(`retires an answered ordinary request for ${audience} only in its current context`, [anInbox()], function* ({ readAttention }) {
		const files = attentionLanesFixture();
		const file = `${audience}.md`;
		const item = `decision.${audience}`;
		const source = files[file]?.replace("managed: true", "managed: false").replace("id: direction", "id: choose") ?? "";
		const answered = { ...files, ...responseRecords(1, item, file, source), [file]: source };
		const lane = audience === "reader" ? "you" : "agents";
		expect(attentionProjection(yield* readAttention(answered))[lane].some((ask) => ask.id === item)).toBe(false);
		expect(attentionProjection(yield* readAttention({ ...answered, [file]: `${source}\nNew context` }))[lane].some((ask) => ask.id === item)).toBe(
			true,
		);
	});
}
