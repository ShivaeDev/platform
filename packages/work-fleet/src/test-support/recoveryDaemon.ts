import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { Clock, Context, Effect, Layer } from "effect";
import { HttpServer } from "effect/unstable/http";
import { fleetHealth } from "@shivaedev/work-board/diagnostics/fleetHealth.ts";
import type { HostParts } from "#host/commands.ts";
import type { FleetHost } from "#host/config.ts";
import { daemonLayer } from "#host/daemon.ts";
import type { Decision } from "#policy.ts";
import { FleetIntegrations } from "#policy.ts";
import { until } from "#test/cloudRestart.ts";
import { daemonClient } from "#test/daemonClient.ts";
import { withHost } from "#test/fleetHost.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { mainObservation, prepared } from "#test/preparation.ts";
import { answerReport } from "#test/report.ts";

function schedulerReady(root: string) {
	return until(() =>
		fleetHealth(root).pipe(
			Effect.map((health) => health.lastSchedulerPass !== null),
			Effect.provide(NodeServices.layer),
		),
	);
}
function responseApplied(client: Effect.Success<ReturnType<typeof daemonClient>>, responseId: string) {
	return until(() =>
		client("fleet.reconcile", { workId: "one" }).pipe(
			Effect.map((record) => record.responses?.some((response) => response.responseId === responseId) ?? false),
		),
	);
}
function serveRecovery<A, E>(
	host: FleetHost,
	parts: HostParts,
	use: (client: Effect.Success<ReturnType<typeof daemonClient>>) => Effect.Effect<A, E>,
) {
	return Effect.scoped(
		Effect.gen(function* () {
			const context = yield* Layer.build(Layer.fresh(daemonLayer(host, parts, 0)));
			yield* schedulerReady(host.boardDir);
			const url = HttpServer.formatAddress(Context.get(context, HttpServer.HttpServer).address);
			return yield* use(yield* daemonClient(url));
		}),
	);
}
export const recoveryDaemon = Effect.fn("Test.recoveryDaemon")(function* (action: "retry" | "release") {
	const github = yield* mergedReviewGithub();
	yield* withHost({}, { intervalSeconds: 3600 }, (fixture) =>
		Effect.gen(function* () {
			const parts = {
				...fixture.parts,
				integrations: Layer.succeed(FleetIntegrations)({
					checks: (_work, result) => github.checksQuery(result),
					delivery: github.deliveryQuery,
					main: (preparation) =>
						Clock.currentTimeMillis.pipe(Effect.map((observedAt) => mainObservation({ fromRevision: preparation.baseRevision, observedAt }))),
					result: github.resultQuery,
				}),
			};

			const decision: Decision = yield* serveRecovery(fixture.host, parts, (client) =>
				Effect.gen(function* () {
					fixture.write("one.md", "---\nid: one\nkind: task\nfleet: approved\n---\n# Scoped work\n");
					yield* client("fleet.prepare", {
						cwd: "/synthetic-repository",
						preparation: prepared({ ownedPaths: ["src/one.ts"] }),
						prompt: "Implement scoped work",
						workId: "one",
					});
					const dispatched = yield* client("fleet.dispatch", { workId: "one" });
					expect(dispatched.decision).toBeUndefined();
					expect(dispatched.stage).toBe("executing");
					const [turn, observation] = [...fixture.provider.observations.entries()][0] ?? [];
					if (turn === undefined || observation === undefined) {
						return yield* Effect.die("Missing worker");
					}
					fixture.provider.observations.set(turn, { ...observation, execution: "failed" });
					const stopped = yield* client("fleet.reconcile", { workId: "one" });
					if (stopped.decision?.published === undefined) {
						return yield* Effect.die("Missing published decision");
					}
					expect(stopped.stage).toBe("needs-human");
					return stopped.decision;
				}),
			);
			if (decision.published === undefined) {
				return yield* Effect.die("Missing receipt");
			}
			yield* serveRecovery(fixture.host, parts, (client) =>
				Effect.gen(function* () {
					const stored = yield* client("fleet.get", { workId: "one" });
					expect(stored.decision).toEqual(decision);
					if (decision.published === undefined) {
						return yield* Effect.die("Missing receipt");
					}
					const responseId = answerReport(fixture.host.boardDir, decision.published, action);
					yield* responseApplied(client, responseId);
					const resolved = yield* client("fleet.get", { workId: "one" });
					expect(resolved.stage).toBe(action === "release" ? "released" : "prepared");
					if (action === "retry") {
						const fresh = yield* client("fleet.dispatch", { workId: "one" });
						expect(fresh.attempts).toHaveLength(2);
						expect(fresh.stage).toBe("executing");
						expect(fresh.decision).toBeUndefined();
					}
				}),
			);
		}),
	);
}, Effect.scoped);
