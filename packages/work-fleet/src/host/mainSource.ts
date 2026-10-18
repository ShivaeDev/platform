import { execFile } from "node:child_process";
import { Clock, Context, Effect, Layer } from "effect";
import { defineService } from "@shivaedev/effect-service/defineService.ts";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { FleetError } from "#errors.ts";
import type { FleetHost } from "#host/config.ts";
import type { MainObservation, Preparation } from "#preparation/schema.ts";

export interface MainSnapshot {
	readonly observedAt: number;
	readonly revision: string;
}

// One snapshot per scheduler pass keeps preparation and dispatch on the same main revision.
export class MainSource extends Context.Service<
	MainSource,
	{
		readonly current: Effect.Effect<MainSnapshot, FleetError>;
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

export function gitMainSource(host: FleetHost) {
	const GitMainSource = defineService({
		id: "Fleet/GitMainSource",
		initialize: Effect.gen(function* () {
			const root = yield* git(host.boardDir, ["rev-parse", "--show-toplevel"]);
			const ref = `${host.repository.remote}/${host.repository.branch}`;
			let snapshot: MainSnapshot | undefined;
			const refresh = Effect.gen(function* () {
				yield* git(root, ["fetch", "--quiet", host.repository.remote, host.repository.branch]);
				const next = { observedAt: yield* Clock.currentTimeMillis, revision: yield* git(root, ["rev-parse", ref]) };
				snapshot = next;
				return next;
			});
			const current = Effect.suspend(() => (snapshot === undefined ? refresh : Effect.succeed(snapshot)));
			return { current, refresh, root };
		}),
		methods: ({ root, current, refresh }) => ({
			current: () => current,
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
			return MainSource.of({ current: main.current(), observe: main.observe, refresh: main.refresh(), repositoryRoot: yield* main.repositoryRoot() });
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
