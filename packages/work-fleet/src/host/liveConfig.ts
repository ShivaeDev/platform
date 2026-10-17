import * as NodeServices from "@effect/platform-node/NodeServices";
import {
	Clock,
	Context,
	Deferred,
	Effect,
	Equal,
	Fiber,
	FileSystem,
	Layer,
	Result,
	Schedule,
	Schema,
	Semaphore,
	Stream,
	SubscriptionRef,
} from "effect";
import { type FleetHost, HostConfig, HostConfigRejected, type HostFailure, readHostConfig, resolveHost } from "#host/config.ts";
import { changedSettings, withReloadable } from "#host/configSettings.ts";
import { hostGuidance } from "#host/guidance.ts";

type Role = "reviewer" | "worker";
type Guidance = Effect.Effect<string | undefined, HostFailure>;

export interface AppliedConfig {
	readonly guidance: Readonly<Record<Role, Guidance>>;
	readonly host: FleetHost;
	readonly loadedAt: number;
	readonly rejected?: HostConfigRejected;
	readonly restartRequired: readonly string[];
}

export class LiveConfig extends Context.Service<
	LiveConfig,
	{ readonly changes: Stream.Stream<AppliedConfig>; readonly current: Effect.Effect<AppliedConfig> }
>()("@shivaedev/work-fleet/LiveConfig") {}

const SETTLE = "100 millis";
const RETRY = Schedule.min([Schedule.exponential("100 millis"), Schedule.spaced("5 seconds")]);

const applyHost = Effect.fn("FleetHost.applyHost")(function* <E>(host: FleetHost, rejected: (role: Role, failure: HostFailure) => E) {
	const guidance = yield* Effect.all({
		reviewer: hostGuidance(host, "reviewer").pipe(Effect.mapError((failure) => rejected("reviewer", failure))),
		worker: hostGuidance(host, "worker").pipe(Effect.mapError((failure) => rejected("worker", failure))),
	});
	const applied: AppliedConfig = { guidance, host, loadedAt: yield* Clock.currentTimeMillis, restartRequired: [] };
	return applied;
});

function served(ref: SubscriptionRef.SubscriptionRef<AppliedConfig>) {
	return LiveConfig.of({ changes: SubscriptionRef.changes(ref), current: SubscriptionRef.get(ref) });
}

export function staticConfig(host: FleetHost) {
	return Layer.effect(LiveConfig)(applyHost(host, (_role, failure) => failure).pipe(Effect.flatMap(SubscriptionRef.make), Effect.map(served)));
}

export function watchedConfig(host: FleetHost) {
	const file = host.configFile;
	return file === undefined ? staticConfig(host) : Layer.effect(LiveConfig)(watchConfig(host, file)).pipe(Layer.provide(NodeServices.layer));
}

const watchConfig = Effect.fn("FleetHost.watchConfig")(function* (host: FleetHost, file: string) {
	const fs = yield* FileSystem.FileSystem;
	const ref = yield* SubscriptionRef.make(yield* applyHost(host, (_role, failure) => failure));
	const lock = yield* Semaphore.make(1);
	let seen = host.config;
	const loadEdit = Effect.fn("FleetHost.loadEdit")(function* (previous: AppliedConfig, next: HostConfig) {
		const config = yield* Schema.decodeUnknownEffect(HostConfig)(withReloadable(previous.host.config, next)).pipe(
			Effect.mapError((error) => new HostConfigRejected({ file, message: `Fleet host configuration ${file} cannot be applied: ${error.message}` })),
		);
		const applied = yield* applyHost(
			resolveHost(previous.host.boardDir, config, file),
			(role, failure) => new HostConfigRejected({ field: `worker.${role}Guidance`, file, message: failure.message }),
		);
		return { ...applied, restartRequired: changedSettings(config, next) };
	});
	const reload = lock.withPermits(1)(
		Effect.gen(function* () {
			const previous = yield* SubscriptionRef.get(ref);
			const outcome = yield* readHostConfig(file).pipe(
				Effect.flatMap((edited) =>
					Equal.equals(edited, seen) && previous.rejected === undefined
						? Effect.succeed(undefined)
						: Effect.map(loadEdit(previous, edited), (loaded) => ({ applied: loaded, next: edited })),
				),
				Effect.result,
			);
			if (Result.isFailure(outcome)) {
				if (previous.rejected?.message !== outcome.failure.message) {
					yield* Effect.logWarning("Fleet kept its last good config after a rejected edit", outcome.failure);
					yield* SubscriptionRef.set(ref, { ...previous, rejected: outcome.failure });
				}
				return;
			}
			if (outcome.success === undefined) {
				return;
			}
			const { applied, next } = outcome.success;
			seen = next;
			if (applied.restartRequired.length > 0 && !Equal.equals(applied.restartRequired, previous.restartRequired)) {
				yield* Effect.logWarning(`Fleet keeps its running values until a daemon restart for: ${applied.restartRequired.join(", ")}`);
			}
			yield* SubscriptionRef.set(ref, applied);
		}),
	);
	const ready = yield* Deferred.make<void>();
	// An editor that saves by renaming replaces the watched file, so each replacement starts a new watch on the new file.
	const watching = Effect.scoped(
		Effect.gen(function* () {
			const events = yield* fs.watch(file).pipe(
				Stream.takeUntil((event) => event._tag !== "Update"),
				Stream.debounce(SETTLE),
				Stream.runForEach(() => reload),
				Effect.forkScoped,
			);
			// The watch registers once its fiber runs; reading after that applies an edit made while no watch was active.
			yield* Effect.sleep(SETTLE);
			yield* reload;
			yield* Deferred.succeed(ready, undefined);
			yield* Fiber.join(events);
		}),
	);
	yield* watching.pipe(
		Effect.tapError((error) =>
			Deferred.succeed(ready, undefined).pipe(Effect.andThen(Effect.logWarning("Watching the Fleet config failed; retrying", error))),
		),
		Effect.retry(RETRY),
		Effect.forever,
		Effect.forkScoped,
	);
	yield* Deferred.await(ready);
	return served(ref);
});
