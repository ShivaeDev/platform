import { execFile } from "node:child_process";
import { Clock, Context, Effect, Layer, Schedule, Semaphore } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import type { FleetError } from "#errors.ts";
import type { FleetHost } from "#host/config.ts";
import { predictedMergeConflicts, predictionGit } from "#host/gitMergeTree.ts";
import type { MainObservation, Preparation } from "#preparation/schema.ts";

export interface MainSnapshot {
	readonly observedAt: number;
	readonly revision: string;
}

// Preparation and dispatch share the snapshot that `refresh` records; `latest` reads main without moving it under them.
export class MainSource extends Context.Service<
	MainSource,
	{
		readonly mergeConflicts?: (head: string, otherHeads: readonly string[]) => Effect.Effect<readonly (readonly string[])[], FleetError>;
		readonly current: Effect.Effect<MainSnapshot, FleetError>;
		readonly latest: Effect.Effect<MainSnapshot, FleetError>;
		readonly observe: (preparation: Preparation) => Effect.Effect<MainObservation, FleetError>;
		readonly refresh: Effect.Effect<MainSnapshot, FleetError>;
		readonly repositoryRoot: string;
	}
>()("@shivaedev/work-fleet/host/MainSource") {}

function git(cwd: string, args: readonly string[]) {
	return Effect.callback<string, FleetError>((resume) => {
		execFile("git", [...args], { cwd, timeout: 60_000 }, (error, stdout) => {
			resume(
				error === null ? Effect.succeed(stdout.trim()) : Effect.fail(new ServiceUnavailable({ message: `git ${args[0]} failed: ${error.message}` })),
			);
		});
	});
}

function refUpdateRace(ref: string, error: FleetError) {
	return (
		(error.message.includes(`cannot lock ref 'refs/remotes/${ref}': is at `) && /is at [0-9a-f]+ but expected [0-9a-f]+/u.test(error.message))
		|| error.message.includes(`fetching ref refs/remotes/${ref} failed: incorrect old value provided`)
	);
}

export function gitMainSource(host: FleetHost) {
	const GitMainSource = defineService({
		id: "Fleet/GitMainSource",
		initialize: Effect.gen(function* () {
			const root = yield* git(host.boardDir, ["rev-parse", "--show-toplevel"]);
			const ref = `${host.repository.remote}/${host.repository.branch}`;
			const fetchLock = yield* Semaphore.make(1);
			let snapshot: MainSnapshot | undefined;
			const latest = Effect.gen(function* () {
				yield* git(root, ["fetch", "--quiet", host.repository.remote, host.repository.branch]).pipe(
					Effect.retry({
						schedule: Schedule.spaced("50 millis"),
						times: 2,
						while: (error) => refUpdateRace(ref, error),
					}),
				);
				return { observedAt: yield* Clock.currentTimeMillis, revision: yield* git(root, ["rev-parse", ref]) };
			}).pipe(fetchLock.withPermit);
			const refresh = Effect.tap(latest, (next) =>
				Effect.sync(() => {
					snapshot = next;
				}),
			);
			const current = Effect.suspend(() => (snapshot === undefined ? refresh : Effect.succeed(snapshot)));
			return { current, latest, refresh, root };
		}),
		methods: ({ root, current, latest, refresh }) => ({
			current: () => current,
			latest: () => latest,
			mergeConflicts: (head: string, otherHeads: readonly string[]) =>
				Effect.gen(function* () {
					const main = yield* git(root, ["rev-parse", `${host.repository.remote}/${host.repository.branch}`]);
					yield* predictionGit(root, ["fetch", "--quiet", host.repository.remote, ...new Set([head, ...otherHeads])]);
					return yield* predictedMergeConflicts(root, main, head, otherHeads);
				}),
			observe: (preparation: Preparation) =>
				Effect.gen(function* () {
					const main = yield* current;
					if (main.revision === preparation.baseRevision) {
						return unchanged(preparation.baseRevision, main);
					}
					const ancestor = yield* git(root, ["merge-base", "--is-ancestor", preparation.baseRevision, main.revision]).pipe(
						Effect.as(true),
						Effect.orElseSucceed(() => false),
					);
					const changed = yield* git(root, ["diff", "--name-only", preparation.baseRevision, main.revision]);
					return {
						ancestor,
						changedPaths: changed.split("\n").filter((path) => path.length > 0),
						complete: true,
						configurationChanges: [],
						fromRevision: preparation.baseRevision,
						observedAt: main.observedAt,
						revision: main.revision,
					};
				}),
			refresh: () => refresh,
			repositoryRoot: () => Effect.succeed(root),
		}),
		requires: [],
	});
	return Layer.effect(MainSource)(
		Effect.gen(function* () {
			const main = yield* GitMainSource;
			return MainSource.of({
				current: main.current(),
				latest: main.latest(),
				mergeConflicts: main.mergeConflicts,
				observe: main.observe,
				refresh: main.refresh(),
				repositoryRoot: yield* main.repositoryRoot(),
			});
		}),
	).pipe(Layer.provide(GitMainSource.layer));
}

export function unchanged(revision: string, main: MainSnapshot): MainObservation {
	return {
		ancestor: true,
		changedPaths: [],
		complete: true,
		configurationChanges: [],
		fromRevision: revision,
		observedAt: main.observedAt,
		revision,
	};
}
