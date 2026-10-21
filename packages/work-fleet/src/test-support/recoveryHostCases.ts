import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { Fleet } from "#fleet.ts";
import { resolveHost } from "#host/config.ts";
import { hostIntegrations } from "#host/integrations.ts";
import { MainSource } from "#host/mainSource.ts";
import { codexQuota } from "#host/quota.ts";
import { FleetIntegrations } from "#policy.ts";
import { syntheticGithub } from "#test/githubApi.ts";
import { HEAD, REPORT } from "#test/githubResult.ts";
import { mainObservation } from "#test/preparation.ts";
import type { RecoveryCase, RecoveryContext } from "#test/recoveryCase.ts";
import { finishRecoveryReview, finishRecoveryWorker, launchRecoveryWorker, setLastObservation } from "#test/recoverySteps.ts";

export function recoveryHostCases(): readonly RecoveryCase[] {
	const snapshot = Effect.succeed({ observedAt: 100, revision: "prepared-main" });
	const stockHost = FleetIntegrations.pipe(
		Effect.provide(
			hostIntegrations(resolveHost("/synthetic", { provider: "local", quota: "unlimited" })).pipe(
				Layer.provide([
					Layer.succeed(MainSource)({
						current: snapshot,
						latest: snapshot,
						observe: () => Effect.succeed(mainObservation()),
						refresh: snapshot,
						repositoryRoot: "/synthetic",
					}),
					syntheticGithub().layer,
				]),
			),
		),
	);
	let context: RecoveryContext | undefined;
	let restored = false;
	let now = 100;
	const refreshQuota = codexQuota(
		() => now,
		Effect.sync(() => (now === 100 || restored ? { ordinaryUsageAllowed: true } : {})),
	);
	return [
		{
			code: "no-change-checks-unconfigured" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				context = ctx;
				yield* finishRecoveryReview(ctx);
			}),
			name: "stock host has no no-change validator",
			options: {
				checksQuery: (result) =>
					stockHost.pipe(
						Effect.flatMap((host) =>
							context === undefined ? Effect.die("Missing recovery context") : host.checks(context.fixture.work("one"), result),
						),
					),
				resultQuery: () => Effect.succeed({ evidence: ["Criteria already met"], head: HEAD, kind: "no-change" }),
			},
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "fleet-integration" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				context = ctx;
				yield* finishRecoveryWorker(ctx);
			}),
			name: "stock host result adoption unconfigured",
			options: {
				resultQuery: (work, observation) =>
					restored && context !== undefined
						? context.github.resultQuery(work, observation)
						: stockHost.pipe(Effect.flatMap((host) => host.result(work, observation))),
			},
			progress: (_ctx, _before, after) => {
				expect(after.step).toBe("reviewing");
				expect(after.attempts.at(-1)?.role).toBe("reviewer");
			},
			restore: () =>
				Effect.sync(() => {
					restored = true;
				}),
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
		{
			code: "fleet-integration" as const,
			enter: Effect.fnUntraced(function* (ctx) {
				yield* launchRecoveryWorker();
				now += 60_000;
				setLastObservation(ctx, { execution: "completed", output: REPORT });
				yield* (yield* Fleet).reconcile("one");
			}),
			name: "host quota reader returns an unknown shape",
			options: { now: () => now, refreshQuota },
			progress: (_ctx, _before, after) => {
				expect(after.step).toBe("reviewing");
				expect(after.attempts.at(-1)?.role).toBe("reviewer");
			},
			restore: () =>
				Effect.sync(() => {
					restored = true;
				}),
			sites: ["engine/reconcileCommand.ts: failureCode(error)"],
		},
	];
}
