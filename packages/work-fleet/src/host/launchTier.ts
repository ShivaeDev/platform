import * as NodeServices from "@effect/platform-node/NodeServices";
import { Clock, Context, Effect, Layer, Schema, Semaphore } from "effect";
import type { FleetHost } from "#host/config.ts";
import { githubJson } from "#host/github.ts";
import { GithubApi } from "#host/githubApi.ts";
import { MainSource } from "#host/mainSource.ts";
import { reportRepository } from "#host/reportPublication.ts";
import { LaunchSettings } from "#session/schema.ts";

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
export const CiCapacity = Schema.Struct({ fastAt: Count, slowAt: Count.check(Schema.isGreaterThan(0)) }).check(
	Schema.makeFilter((value) => value.fastAt < value.slowAt || "ciCapacity.fastAt must be below ciCapacity.slowAt"),
);
export const HostLaunchSettings = Schema.Struct({
	...LaunchSettings.fields,
	serviceTier: Schema.optional(Schema.Union([Schema.String.check(Schema.isMinLength(1)), Schema.Struct({ ciCapacity: CiCapacity })])),
});
export const LaunchTierStatus = Schema.Struct({
	ciCapacity: Schema.optional(CiCapacity),
	queuedRuns: Schema.optional(Count),
	readFailed: Schema.Boolean,
	serviceTier: Schema.optional(Schema.String),
});
type LaunchTierStatus = typeof LaunchTierStatus.Type;

export class LaunchTier extends Context.Service<
	LaunchTier,
	{
		readonly resolve: (host: FleetHost) => Effect.Effect<LaunchSettings>;
		readonly status: Effect.Effect<LaunchTierStatus>;
	}
>()("@shivaedev/work-fleet/host/LaunchTier") {}

export const launchTierLayer = Layer.effect(LaunchTier)(
	Effect.gen(function* () {
		const github = yield* GithubApi;
		const main = yield* MainSource;
		const lock = yield* Semaphore.make(1);
		let status: LaunchTierStatus = { readFailed: false };
		let nextRead = 0;
		let tier: "fast" | undefined = "fast";
		const refresh = Effect.fn("FleetHost.refresh")(function* (host: FleetHost, ciCapacity: typeof CiCapacity.Type) {
			const observation = yield* Effect.gen(function* () {
				const repository = yield* reportRepository(main.repositoryRoot, host.repository.remote);
				return yield* githubJson(
					Schema.Struct({ queuedRuns: Count }).pipe(Schema.encodeKeys({ queuedRuns: "total_count" })),
					github.get(`repos/${repository}/actions/runs?status=queued&per_page=1`),
				);
			}).pipe(Effect.provide(NodeServices.layer), Effect.result);
			if (observation._tag === "Failure") {
				status = { ...status, ciCapacity, readFailed: true, serviceTier: tier };
				return;
			}
			const { queuedRuns } = observation.success;
			if (queuedRuns >= ciCapacity.slowAt) {
				tier = undefined;
			} else if (queuedRuns <= ciCapacity.fastAt) {
				tier = "fast";
			}
			status = { ciCapacity, queuedRuns, readFailed: false, serviceTier: tier };
		});
		const resolve = Effect.fn("FleetHost.resolve")(function* (host: FleetHost) {
			const { serviceTier, ...settings } = host.launch;
			if (typeof serviceTier !== "object") {
				const selected = serviceTier === undefined ? {} : { serviceTier };
				status = { readFailed: false, ...selected };
				return { ...settings, ...selected };
			}
			const { ciCapacity } = serviceTier;
			const now = yield* Clock.currentTimeMillis;
			if (now >= nextRead) {
				nextRead = now + host.interval * 1000;
				yield* refresh(host, ciCapacity);
			}
			status = { ...status, ciCapacity, serviceTier: tier };
			return tier === undefined ? settings : { ...settings, serviceTier: tier };
		});
		return LaunchTier.of({ resolve: (host) => resolve(host).pipe(lock.withPermit), status: Effect.sync(() => status) });
	}),
);

export function renderLaunchTier(status: LaunchTierStatus): string {
	const selected = `Service tier ${status.serviceTier ?? "provider default"}`;
	if (status.ciCapacity === undefined) {
		return `${selected} (fixed)`;
	}
	const { fastAt, slowAt } = status.ciCapacity;
	return `${selected}: ${status.queuedRuns ?? "unknown"} queued CI runs; provider default at >= ${slowAt}, fast at <= ${fastAt}${status.readFailed ? "; read failed, keeping last tier" : ""}`;
}
