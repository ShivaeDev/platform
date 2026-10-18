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
import { untilEveryOutput, withFollower } from "#test/follower.ts";
import type { Follower } from "#test/followerProcess.ts";
import { mainObservation } from "#test/preparation.ts";
import { readDaemonLayer } from "#test/readDaemon.ts";
import { answerReport } from "#test/report.ts";
import { statusRecord } from "#test/status.ts";
import { storeState } from "#test/storeState.ts";

type Client = Effect.Success<ReturnType<typeof daemonClient>>;

interface SchedulerWatch {
	readonly client: Client;
	readonly fixture: HostFixture;
	readonly followers: readonly Follower[];
	readonly provider: ReturnType<typeof engineProvider>;
	readonly readClient: Client;
	readonly reviews: readonly string[];
}

export const watchScheduler = Effect.fn("WatchSchedulerTest.watchScheduler")(function* (fixture: HostFixture, paused: boolean) {
	fixture.write("connected.md", task("connected", "approved"));
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
	const client = yield* daemonClient(HttpServer.formatAddress(Context.get(context, HttpServer.HttpServer).address));
	const reader = yield* Layer.build(Layer.fresh(readDaemonLayer(fixture.host, { parts })));
	const readUrl = HttpServer.formatAddress(Context.get(reader, HttpServer.HttpServer).address);
	const readClient = yield* daemonClient(readUrl);
	const options = { follow: true, port: Number(new URL(readUrl).port) };
	yield* withFollower(fixture.configFile, "watch", [], options, (all) =>
		withFollower(fixture.configFile, "watch", ["connected", "one"], options, (explicit) =>
			followScheduler({ client, fixture, followers: [all, explicit], provider, readClient, reviews }, paused),
		),
	);
});

const followScheduler = Effect.fn("WatchSchedulerTest.followScheduler")(function* (watch: SchedulerWatch, paused: boolean) {
	const { client, fixture, followers, provider } = watch;
	yield* untilEveryOutput(followers, "connected needs-human (waiting on orchestrator): Watch connected\n");
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
	expect(followers.map((follower) => follower.output().includes("one needs-human"))).toEqual([false, false]);
	if (paused) {
		fixture.write("one.md", task("one", "draft"));
		yield* until(() => client("fleet.get", { workId: "one" }).pipe(Effect.map((record) => record.decision?.published !== undefined)));
		yield* untilEveryOutput(followers, "one needs-human (waiting on maintainer): Work is no longer approved\n");
	}
	finishWorkers(provider);
	if (paused) {
		yield* approveAgain(watch);
	}
	yield* until(() => client("fleet.get", { workId: "one" }).pipe(Effect.map((record) => record.decision?.code === "reviewed-pr-ready")));
	expect((yield* client("fleet.get", { workId: "one" })).stage).toBe("needs-human");
	expect((yield* watch.readClient("fleet.get", { workId: "one" })).decision?.code).toBe("reviewed-pr-ready");
	yield* untilEveryOutput(followers, "one needs-human (waiting on orchestrator): Reviewed PR is ready to merge\n").pipe(Effect.timeout("5 seconds"));
	expect(followers.map((follower) => follower.isRunning())).toEqual([true, true]);
	expect(watch.reviews).toEqual(["head-one-0"]);
	expect((yield* client("fleet.get", { workId: "one" })).review).toMatchObject({ head: "head-one-0", verdict: "approved" });
});

const approveAgain = Effect.fn("WatchSchedulerTest.approveAgain")(function* ({ client, fixture }: SchedulerWatch) {
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
});

function hasReceipt(record: FleetRecord, role: "worker" | "reviewer") {
	return record.attempts.some((attempt) => attempt.role === role && attempt.receipt !== undefined);
}
