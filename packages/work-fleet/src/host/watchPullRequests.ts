import { join } from "node:path";
import { Deferred, Effect, Layer } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { Options } from "@shivaedev/pr-watch/model.ts";
import { watch } from "@shivaedev/pr-watch/program.ts";
import { watchPrLayer } from "#host/watchPrLayer.ts";
import type { WatchState } from "#host/watchState.ts";
import type { WatchStreamOptions } from "#host/watchStream.ts";

export const watchPullRequests = Effect.fn("FleetWatch.watchPullRequests")(function* (
	options: WatchStreamOptions,
	emit: (event: { readonly kind: string; readonly [key: string]: unknown }) => Effect.Effect<void>,
) {
	const scope = yield* Effect.scope;
	const failed = yield* Deferred.make<never, Effect.Error<ReturnType<typeof watch>> | Layer.Error<ReturnType<typeof watchPrLayer>>>();
	const repositories = new Map<string, Map<number, string>>();
	const start = Effect.fnUntraced(function* (repository: string, work: Map<number, string>) {
		const settings: Options = {
			apiUrl: options.apiUrl ?? "https://api.github.com",
			events: ["dequeued", "stuck", "conflict", "auto-merge-off", "merged", "closed"],
			fleet: true,
			interval: options.prIntervalMs ?? 60_000,
			get numbers() {
				return [...work.keys()];
			},
			repository,
			stateFile: join(options.board, ".pr-watch", `${repository.replace("/", "-")}.json`),
		};
		function write(line: string) {
			const { event, number: prNumber, ...fields } = JSON.parse(line);
			return emit({
				...fields,
				kind: `pr-${event}`,
				repository,
				...(prNumber === undefined ? {} : { number: prNumber, pr: `https://github.com/${repository}/pull/${prNumber}`, workId: work.get(prNumber) }),
			});
		}
		yield* watch(settings, { heartbeat: 0, once: false }, write, () => Effect.void).pipe(
			Effect.provide(
				Layer.fresh(
					watchPrLayer((number, message) =>
						emit({ kind: "pr-error", message, number, pr: `https://github.com/${repository}/pull/${number}`, repository, workId: work.get(number) }),
					),
				),
			),
			Effect.tapError((error) =>
				error instanceof ServiceUnavailable ? emit({ kind: "pr-error", message: error.message, repository }) : Effect.void,
			),
			Effect.catch((error) => Deferred.fail(failed, error)),
			Effect.forkIn(scope),
		);
	});
	const update = Effect.fnUntraced(function* (states: readonly WatchState[]) {
		if (!options.prEvents) {
			return;
		}
		for (const state of states) {
			if (state.stage === "done") {
				continue;
			}
			const target = pullTarget(state.result?.pr);
			if (target === undefined) {
				continue;
			}
			const existing = repositories.get(target.repository);
			if (existing) {
				existing.set(target.number, state.workId);
				continue;
			}
			const work = new Map([[target.number, state.workId]]);
			repositories.set(target.repository, work);
			yield* start(target.repository, work);
		}
	});
	return { failed: Deferred.await(failed), update };
});

function pullTarget(pr: string | undefined) {
	const match = pr?.match(/^https:\/\/[^/]+\/(?<repository>[^/]+\/[^/]+)\/pull\/(?<number>\d+)$/u);
	const repository = match?.groups?.repository;
	const number = match?.groups?.number;
	return repository === undefined || number === undefined ? undefined : { number: Number(number), repository };
}
