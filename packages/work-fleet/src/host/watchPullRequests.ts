import { join } from "node:path";
import { Deferred, Effect, Layer } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { Options } from "@shivaedev/pr-watch/model.ts";
import type { WatchEvent } from "@shivaedev/pr-watch/outputEvent.ts";
import { watch } from "@shivaedev/pr-watch/program.ts";
import { requestFailure } from "@shivaedev/pr-watch/requestFailure.ts";
import { watchPrLayer } from "#host/watchPrLayer.ts";
import type { WatchState } from "#host/watchState.ts";
import type { WatchStreamOptions } from "#host/watchStream.ts";

type WatchFailure = Effect.Error<ReturnType<typeof watch<never, never, never, never>>>;

export const watchPullRequests = Effect.fn("FleetWatch.watchPullRequests")(function* (
	options: WatchStreamOptions,
	emit: (event: { readonly kind: string; readonly [key: string]: unknown }) => Effect.Effect<void>,
) {
	const scope = yield* Effect.scope;
	const failed = yield* Deferred.make<never, WatchFailure | Layer.Error<ReturnType<typeof watchPrLayer>>>();
	const repositories = new Map<string, Map<number, string>>();
	const start = Effect.fnUntraced(function* (repository: string, work: Map<number, string>) {
		const transient = new Set<string>();
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
		function write(value: WatchEvent) {
			const { event, ...fields } = value;
			const prNumber = "number" in value ? value.number : undefined;
			return emit({
				...fields,
				kind: `pr-${event}`,
				repository,
				...(event === "error" ? { retryable: transient.has(value.message) } : {}),
				...(prNumber === undefined ? {} : { number: prNumber, pr: `https://github.com/${repository}/pull/${prNumber}`, workId: work.get(prNumber) }),
			});
		}
		function report(number: number, message: string, retryable: boolean) {
			return emit({
				kind: "pr-error",
				message,
				number,
				pr: `https://github.com/${repository}/pull/${number}`,
				repository,
				retryable,
				workId: work.get(number),
			});
		}
		function recordFailure(error: unknown) {
			const failure = requestFailure(error);
			if (failure.retryable || failure.retryAt !== undefined) {
				transient.add(failure.message);
			}
		}
		yield* watch(settings, { heartbeat: 0, once: false }, write, () => Effect.void).pipe(
			Effect.provide(Layer.fresh(watchPrLayer(report, { failure: recordFailure }))),
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
		for (const state of states.flatMap((entry) => [entry, ...(entry.releaseWindow ? [{ ...entry, result: { pr: entry.releaseWindow.pr } }] : [])])) {
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
