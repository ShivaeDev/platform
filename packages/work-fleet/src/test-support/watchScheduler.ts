import { expect } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { daemonLayer } from "#host/daemon.ts";
import type { FleetRecord } from "#model.ts";
import { until } from "#test/cloudRestart.ts";
import { daemonClient } from "#test/daemonClient.ts";
import { finishWorkers } from "#test/engine.ts";
import { engineIntegrations } from "#test/engineIntegrations.ts";
import { engineProvider } from "#test/engineProvider.ts";
import { type HostFixture, task } from "#test/fleetHost.ts";
import { untilOutput, withFollower } from "#test/follower.ts";
import { mainObservation } from "#test/preparation.ts";
import { answerReport } from "#test/report.ts";
import { statusRecord } from "#test/status.ts";
import { storeState } from "#test/storeState.ts";

export const watchScheduler = Effect.fn("WatchSchedulerTest.watchScheduler")(function* (
	fixture: HostFixture,
	ids: readonly string[],
	paused: boolean,
) {
	yield* storeState(fixture.host, "connected", {
		...statusRecord("connected", "needs-human"),
		decision: { attentionOwner: "orchestrator", id: "connected", links: [], reason: "Watch connected", recommendation: "retry" },
	});
	const reviews: string[] = [];
	const provider = engineProvider({ reviewRunning: true }, reviews);
	const parts = {
		...fixture.parts,
		integrations: engineIntegrations(
			{
				denyDelivery: true,
				mainQuery: (preparation) => Effect.succeed(mainObservation({ fromRevision: preparation.baseRevision, revision: preparation.baseRevision })),
			},
			[],
		),
		provider: provider.transport,
	};
	const context = yield* Layer.build(Layer.fresh(daemonLayer(fixture.host, parts, 0)));
	const url = HttpServer.formatAddress(Context.get(context, HttpServer.HttpServer).address);
	const client = yield* daemonClient(url);
	yield* withFollower(fixture.configFile, "watch", ids, { follow: true, port: Number(new URL(url).port) }, (follower) =>
		Effect.gen(function* () {
			yield* untilOutput(follower, "connected needs-human (waiting on orchestrator): Watch connected\n");
			expect(provider.starts).toHaveLength(0);
			fixture.write("one.md", task("one", "approved"));
			yield* until(() =>
				client("fleet.get", { workId: "one" }).pipe(
					Effect.map((record) => hasReceipt(record, "worker")),
					Effect.catchTag("NotFound", () => Effect.succeed(false)),
				),
			);
			finishWorkers(provider);
			yield* until(() => client("fleet.get", { workId: "one" }).pipe(Effect.map((record) => hasReceipt(record, "reviewer"))));
			expect(follower.output()).not.toContain("one needs-human");
			if (paused) {
				fixture.write("one.md", task("one", "draft"));
				yield* until(() => client("fleet.get", { workId: "one" }).pipe(Effect.map((record) => record.decision?.published !== undefined)));
				yield* untilOutput(follower, "one needs-human (waiting on maintainer): Work is no longer approved\n");
			}
			finishWorkers(provider);
			if (paused) {
				yield* until(() => client("fleet.get", { workId: "one" }).pipe(Effect.map((record) => record.attempts.at(-1)?.status === "completed")));
				const waiting = yield* client("fleet.get", { workId: "one" });
				expect(waiting.stage).toBe("needs-human");
				expect(waiting.review).toBeUndefined();
				const decision = waiting.decision?.published;
				if (decision === undefined) {
					return yield* Effect.die("Missing approval decision");
				}
				fixture.write("one.md", task("one", "approved"));
				answerReport(fixture.host.boardDir, decision, "retry");
			}
			yield* until(() => client("fleet.get", { workId: "one" }).pipe(Effect.map((record) => record.decision?.code === "reviewed-pr-ready")));
			yield* untilOutput(follower, "one needs-human (waiting on maintainer): Reviewed PR is ready to merge\n").pipe(Effect.timeout("5 seconds"));
			expect(reviews).toEqual(["head-one-0"]);
			expect((yield* client("fleet.get", { workId: "one" })).review).toMatchObject({ head: "head-one-0", verdict: "approved" });
			expect(follower.isRunning()).toBe(true);
		}),
	);
});

function hasReceipt(record: FleetRecord, role: "worker" | "reviewer") {
	return record.attempts.some((attempt) => attempt.role === role && attempt.receipt !== undefined);
}
