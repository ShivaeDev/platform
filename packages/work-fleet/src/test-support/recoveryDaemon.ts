import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Clock, Effect, Layer, Redacted, Result } from "effect";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { markdownBoard } from "#board/markdown.ts";
import { ReportInspection } from "#engine/ReportInspection.ts";
import { isFleetError } from "#errors.ts";
import { resolveHost } from "#host/config.ts";
import type { FleetRecord } from "#model.ts";
import { FleetIntegrations } from "#policy.ts";
import type { daemonClient } from "#test/daemonClient.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { syntheticGithub } from "#test/githubApi.ts";
import { fixedMainSource } from "#test/mainSource.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { mainObservation, prepared } from "#test/preparation.ts";
import { answerReport } from "#test/report.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";
import { serveRecovery } from "#test/serveRecovery.ts";

const acknowledgedResponse = Effect.fn("Test.acknowledgedResponse")(function* (
	client: Effect.Success<ReturnType<typeof daemonClient>>,
	responseId: string,
) {
	const receipt = yield* eventually(
		Effect.result(client("fleet.get", { workId: "one" })).pipe(
			Effect.flatMap((observed): Effect.Effect<Result.Result<FleetRecord, unknown>, string> => {
				if (Result.isFailure(observed)) {
					return isFleetError(observed.failure) && observed.failure._tag === "Conflict"
						? Effect.fail("Reload stale Fleet observation")
						: Effect.succeed(observed);
				}
				return observed.success.responses?.some((response) => response.responseId === responseId && response.boardAcknowledged === true)
					? Effect.succeed(observed)
					: Effect.fail("Wait for the exact acknowledged response");
			}),
		),
		{ interval: "20 millis", times: 1000 },
	);
	return yield* Effect.fromResult(receipt);
});
export const recoveryDaemon = Effect.fn("Test.recoveryDaemon")(function* (state: EngineStory) {
	const github = yield* mergedReviewGithub();
	const database = yield* PostgresTestDatabase;
	const runtime = running(state);
	const host = resolveHost(state.root, {
		database: { url: Redacted.value(database.url) },
		intervalSeconds: 3600,
		namespace: STORAGE_NAMESPACE,
		provider: "local",
		quota: "unlimited",
	});

	const parts = {
		board: Layer.merge(
			markdownBoard(state.root).pipe(Layer.provide(NodeServices.layer)),
			Layer.succeed(ReportInspection)({ check: () => Effect.void }),
		),
		github: syntheticGithub().layer,
		integrations: Layer.succeed(FleetIntegrations)({
			checks: (_work, result) => github.checksQuery(result),
			delivery: github.deliveryQuery,
			main: (preparation) =>
				Clock.currentTimeMillis.pipe(Effect.map((observedAt) => mainObservation({ fromRevision: preparation.baseRevision, observedAt }))),
			result: github.resultQuery,
		}),
		main: fixedMainSource(),
		provider: runtime.transport,
	};

	rmSync(join(state.root, "one.md"));
	const initial = yield* serveRecovery(host, parts, (client) =>
		Effect.gen(function* () {
			writeFileSync(join(state.root, "one.md"), state.source);
			yield* client("fleet.prepare", {
				cwd: "/synthetic-repository",
				preparation: prepared({ ownedPaths: ["src/one.ts"] }),
				prompt: "Implement scoped work",
				workId: "one",
			});
			const dispatched = yield* client("fleet.dispatch", { workId: "one" });
			const [turn, observation] = [...runtime.fixture.observations.entries()][0] ?? [];
			if (turn === undefined || observation === undefined) {
				return yield* Effect.die("Missing worker");
			}
			runtime.fixture.observations.set(turn, { ...observation, execution: "failed" });
			const stopped = yield* client("fleet.reconcile", { workId: "one" });
			if (stopped.decision?.published === undefined) {
				return yield* Effect.die("Missing published decision");
			}
			return { decision: stopped.decision, dispatched, stopped };
		}),
	);
	const { decision } = initial;
	if (decision.published === undefined) {
		return yield* Effect.die("Missing receipt");
	}
	const published = decision.published;
	return {
		...initial,
		answerOffline: (action: "retry" | "release") => answerReport(state.root, published, action),
		restart: (action: "retry" | "release", responseId: string) =>
			serveRecovery(host, parts, (client) =>
				Effect.gen(function* () {
					const resolved = yield* acknowledgedResponse(client, responseId);
					const fresh = action === "retry" && resolved.step === "queued" ? yield* client("fleet.dispatch", { workId: "one" }) : resolved;
					return { fresh, resolved };
				}),
			),
	};
});
