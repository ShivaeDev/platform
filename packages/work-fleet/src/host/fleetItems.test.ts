import { expect } from "vitest";
import { itemRecord } from "#test/fleetItemStore.ts";
import { diagnosticClock } from "#test/hostDatabaseTraits.ts";
import { host } from "#test/hostStory.ts";

host.it("the daemon contract lists every unfinished step and only completions within seven days", [diagnosticClock], function* (daemon) {
	const now = daemon.diagnosticTime();
	const cutoff = now - 7 * 24 * 60 * 60 * 1000;
	const records = [
		...(["queued", "working", "adopting", "reviewing", "repairing", "validating", "delivering", "waiting", "released"] as const).map((step) =>
			itemRecord(step),
		),
		itemRecord("done", { completedAt: cutoff, workId: "boundary" }),
		itemRecord("done", { completedAt: now, workId: "recent" }),
		itemRecord("done", { completedAt: cutoff - 1, workId: "old" }),
		itemRecord("done", { completedAt: now + 1, workId: "future" }),
		itemRecord("done", { workId: "unknown" }),
		itemRecord("queued", { stageEnteredAt: undefined, updatedAt: undefined, workId: "legacy" }),
		itemRecord("waiting", {
			attentionOwner: "maintainer",
			result: { head: "head", kind: "change", paths: [], pr: "https://example.invalid/pr/1" },
			workId: "merge",
		}),
		itemRecord("validating", { checks: { evidence: [], head: "head", passed: false, pending: true }, workId: "checks" }),
	];
	yield* daemon.storeRecords(records);
	const result = yield* daemon.fleetItems();
	expect(result.items.map((item) => item.workId)).toEqual([
		"queued",
		"working",
		"adopting",
		"reviewing",
		"repairing",
		"validating",
		"delivering",
		"waiting",
		"legacy",
		"merge",
		"checks",
	]);
	expect(result.completed.map(({ workId, completedAt }) => ({ completedAt, workId }))).toEqual([
		{ completedAt: cutoff, workId: "boundary" },
		{ completedAt: now, workId: "recent" },
	]);
	expect(result.items[0]).toMatchObject({ stageEnteredAt: 100, updatedAt: 200 });
	expect(result.items.find((item) => item.workId === "legacy")).toMatchObject({ stageEnteredAt: null, updatedAt: null });
	expect(result.items.find((item) => item.workId === "merge")).toMatchObject({ attentionOwner: "maintainer", prUrl: "https://example.invalid/pr/1" });
	expect(result.items.find((item) => item.workId === "waiting")?.attentionOwner).toBe("orchestrator");
	expect(result.items.find((item) => item.workId === "checks")?.attentionOwner).toBe("automation");
	expect(result.items[0]?.attentionOwner).toBeUndefined();
	daemon.advanceDiagnosticTime(1);
	expect((yield* daemon.fleetItems()).completed.map((item) => item.workId)).toEqual(["recent", "future"]);
});
