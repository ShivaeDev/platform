import { DateTime, Deferred, Effect, Option, Stream } from "effect";
import { JobsUnavailable } from "@shivaedev/admin/jobs/schemas.ts";
import type { AdminJob } from "#client/admin/jobsTypes.ts";

export function adminBackend() {
	const state: {
		activeStreams: number;
		failed: boolean;
		gate: Deferred.Deferred<void> | undefined;
		jobs: ReturnType<typeof failedJob>[];
		retryFails: boolean;
		statistics: { notes: number; pending: number; words: number };
	} = {
		activeStreams: 0,
		failed: false,
		gate: undefined,
		jobs: [],
		retryFails: false,
		statistics: { notes: 0, pending: 0, words: 0 },
	};
	function changes() {
		return Stream.concat(Stream.succeed({ _tag: "Resync" } as const), Stream.never).pipe(
			Stream.onStart(
				Effect.sync(() => {
					state.activeStreams += 1;
				}),
			),
			Stream.ensuring(
				Effect.sync(() => {
					state.activeStreams -= 1;
				}),
			),
		);
	}
	const health = Effect.gen(function* () {
		if (state.gate !== undefined) {
			yield* Deferred.await(state.gate);
		}
		if (state.failed) {
			return yield* Effect.fail(new JobsUnavailable({ operation: "health" }));
		}
		return { activeTotal: 0, deadLetteredTotal: 1, failedTotal: state.jobs.length, jobs: [], queuedTotal: 0, readyTotal: 0 };
	});
	return {
		changes,
		handlers: {
			"admin.jobs.$changes": changes,
			"admin.jobs.counts": () =>
				Effect.sync(() => ({ activeCount: 0, failedCount: state.jobs.length, queuedCount: 0, totalCount: state.jobs.length })),
			"admin.jobs.deadLettered": () =>
				Effect.succeed({
					jobs: [
						{
							...failedJob("dead-copy"),
							queue: "count-note-words-dlq",
							sourceId: Option.some("original-job"),
							sourceOutput: { message: "Original failed" },
						},
					],
					next: Option.none<string>(),
				}),
			"admin.jobs.failed": ({ cursor }: { readonly cursor?: string }) =>
				Effect.sync(() => ({
					jobs: state.jobs.slice(cursor === undefined ? 0 : 1, cursor === undefined ? 1 : 2),
					next: cursor === undefined && state.jobs.length > 1 ? Option.some("page-two") : Option.none<string>(),
				})),
			"admin.jobs.health": () => health,
			"admin.jobs.job": ({ id }: { readonly id: string }) => Effect.sync(() => Option.fromUndefinedOr(state.jobs.find((job) => job.id === id))),
			"admin.notes.$changes": changes,
			"admin.notes.statistics": () => Effect.sync(() => ({ ...state.statistics })),
			"admin.users.$changes": changes,
			"admin.users.changeRole": () => Effect.void,
			"admin.users.list": () => Effect.succeed({ canChangeRoles: false, next: Option.none<string>(), users: [] }),
		},
		retry: ({ id }: { readonly id: string }) =>
			Effect.suspend(() =>
				state.retryFails
					? Effect.fail(new JobsUnavailable({ operation: "retry" }))
					: Effect.sync(() => {
							state.jobs = state.jobs.filter((job) => job.id !== id);
						}),
			),
		state,
	};
}

export function failedJob(id: string): AdminJob & { readonly data: { readonly noteId: number } } {
	return {
		attempt: 2,
		completedOn: Option.some(DateTime.makeUnsafe("2026-10-25T11:00:00Z")),
		createdOn: DateTime.makeUnsafe("2026-10-25T10:00:00Z"),
		data: { noteId: 42 },
		id,
		output: { message: "Worker unavailable" },
		queue: "count-note-words",
		retryCount: 1,
		retryLimit: 1,
		startedOn: Option.some(DateTime.makeUnsafe("2026-10-25T10:59:00Z")),
		state: "failed",
	};
}
