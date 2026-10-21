import { Clock, Effect } from "effect";
import { RpcTest } from "effect/rpc";
import { TestClock } from "effect/testing";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { diagnostics } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import { HealthSnapshot } from "#engine/health.ts";
import { FleetRepository } from "#engine/repository.ts";
import { daemonDiagnostics } from "#host/daemonDiagnostics.ts";
import { fleetItemStore, itemRecord } from "#test/fleetItemStore.ts";
import { healthSnapshot } from "#test/health.ts";

it.effect("the daemon contract lists every unfinished step and only completions within seven days", function* () {
	yield* TestClock.adjust("10 days");
	const now = yield* Clock.currentTimeMillis;
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
	const sources = {
		codex: Effect.fail(new diagnostics.SourceFailure({ kind: "not-configured", message: "Synthetic" })),
		fleet: Effect.succeed(healthSnapshot),
		github: Effect.fail(new diagnostics.SourceFailure({ kind: "not-configured", message: "Synthetic" })),
	};
	const handlers = yield* daemonDiagnostics.pipe(
		Effect.provideService(FleetRepository, fleetItemStore(records)),
		Effect.provideService(HealthSnapshot, Effect.succeed(healthSnapshot)),
		Effect.provideService(diagnostics.DiagnosticsSources, sources),
	);
	const client = yield* RpcTest.makeClient(diagnostics.DiagnosticsContract.omit("daemon.$changes"), { flatten: true }).pipe(Effect.provide(handlers));
	const result = yield* client("daemon.fleetItems", {});
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
	yield* TestClock.adjust("1 milli");
	expect((yield* client("daemon.fleetItems", {})).completed.map((item) => item.workId)).toEqual(["recent", "future"]);
});
