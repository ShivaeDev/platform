import { Effect } from "effect";
import { RpcTest } from "effect/rpc";
import { expect, it } from "vitest";
import { workRpcs } from "#rpc/contract.ts";
import { attention } from "#server/integration/attention.ts";
import { inboxCount } from "#server/navigation/model.ts";
import { attentionLanesFixture } from "#test/attentionLanesFixture.ts";
import { inboxSnapshot } from "#test/inboxFixture.ts";
import { inMemoryBoard } from "#test/inMemoryBoard.ts";
import { responseRecords } from "#test/responseRecords.ts";
import { attentionProjection } from "./projection.ts";

it("partitions asks and reports source diagnostics separately with one count for all queries", async () => {
	const snapshot = { ...inboxSnapshot(attentionLanesFixture("Casey")), maintainer: "Casey" };
	const projection = attention.projection(snapshot);
	expect(projection.you.map((item) => item.id)).toEqual(["decision.reader", "question.storage", "task.person"]);
	expect(projection.agents.map((item) => item.id)).toEqual(["task.planned", "decision.orchestrator", "decision.automation"]);
	expect(projection.agents.map((item) => item.responseFrom)).toEqual([["maintainer"], ["orchestrator"], ["automation"]]);
	expect(projection.resolved.map((item) => item.id)).toEqual(["task.done", "task.done", "task.done", "task.superseded"]);
	expect(projection.parked.map((item) => item.id)).toEqual(["task.deferred"]);
	expect(projection.issues.map((issue) => issue.file)).toEqual(["unknown.md", "unresolved.md"]);
	const inbox = await Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const client = yield* RpcTest.makeClient(workRpcs, { flatten: true });
				return yield* client("work-board.inbox", undefined);
			}),
		).pipe(Effect.provide(inMemoryBoard(attentionLanesFixture("Casey"), { home: undefined, index: Effect.succeed(snapshot) }))),
	);
	expect([inbox.you.length, inboxCount(snapshot)]).toEqual([3, 3]);
	expect(inbox).toEqual(projection);
});

it("includes unregistered asks and isolates audiences when they share a target", () => {
	const files = attentionLanesFixture();
	files["reader.md"] = files["reader.md"]?.replace("managed: true", "managed: false").replace("[maintainer]", "[orchestrator, maintainer]") ?? "";
	files["orchestrator.md"] = files["orchestrator.md"]?.replace("unblocks: [decision.orchestrator]", "unblocks: [decision.reader]") ?? "";
	const data = attentionProjection(inboxSnapshot(files));
	expect(data.you.map((item) => item.id)).toEqual(["task.planned", "decision.reader", "question.storage", "task.person"]);
	expect(data.agents.map((item) => item.responseFrom)).toEqual([["orchestrator"], ["automation"]]);
	expect(data.agents[0]?.id).toBe("decision.reader");
});

it("withholds all lanes and the badge when the workspace is incomplete", () => {
	const snapshot = inboxSnapshot(attentionLanesFixture(), ["unreadable.md"]);
	const data = attentionProjection(snapshot);
	expect(data.complete).toBe(false);
	expect([data.you, data.agents, data.resolved, data.parked]).toEqual([[], [], [], []]);
	expect(inboxCount(snapshot)).toBeNull();
});

it("preserves a person's next action when an agent request targets the same item", () => {
	const files = attentionLanesFixture();
	files["orchestrator.md"] = files["orchestrator.md"]?.replace("unblocks: [decision.orchestrator]", "unblocks: [task.person]") ?? "";
	const data = attentionProjection(inboxSnapshot(files));
	expect(data.you.find((item) => item.id === "task.person")?.reason).toBe("Casey: Read the evidence");
	expect(data.agents.find((item) => item.id === "task.person")?.responseFrom).toEqual(["orchestrator"]);
});

it.each(["reader", "orchestrator"])("retires an answered ordinary request for %s only in its current context", (audience) => {
	const files = attentionLanesFixture();
	const file = `${audience}.md`;
	const item = `decision.${audience}`;
	const source = files[file]?.replace("managed: true", "managed: false").replace("id: direction", "id: choose") ?? "";
	const answered = { ...files, ...responseRecords(1, item, file, source), [file]: source };
	const lane = audience === "reader" ? "you" : "agents";
	expect(attentionProjection(inboxSnapshot(answered))[lane].some((ask) => ask.id === item)).toBe(false);
	expect(attentionProjection(inboxSnapshot({ ...answered, [file]: `${source}\nNew context` }))[lane].some((ask) => ask.id === item)).toBe(true);
});
