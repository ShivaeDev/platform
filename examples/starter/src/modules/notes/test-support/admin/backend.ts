import { DateTime, Effect, Option, Stream } from "effect";

export function adminBackend() {
	const state: {
		activeStreams: number;
		jobs: ReturnType<typeof failedJob>[];
		statistics: { notes: number; pending: number; words: number };
	} = {
		activeStreams: 0,
		jobs: [],
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
	const health = Effect.sync(() => ({
		activeTotal: 0,
		deadLetteredTotal: 0,
		failedTotal: state.jobs.length,
		jobs: [],
		queuedTotal: 0,
		readyTotal: 0,
	}));
	return {
		changes,
		handlers: {
			"admin.jobs.$changes": changes,
			"admin.jobs.counts": () =>
				Effect.sync(() => ({ activeCount: 0, failedCount: state.jobs.length, queuedCount: 0, totalCount: state.jobs.length })),
			"admin.jobs.deadLettered": () => Effect.succeed({ jobs: [], next: Option.none<string>() }),
			"admin.jobs.failed": () => Effect.sync(() => ({ jobs: state.jobs, next: Option.none<string>() })),
			"admin.jobs.health": () => health,
			"admin.jobs.job": ({ id }: { readonly id: string }) => Effect.sync(() => Option.fromUndefinedOr(state.jobs.find((job) => job.id === id))),
			"admin.notes.$changes": changes,
			"admin.notes.statistics": () => Effect.sync(() => ({ ...state.statistics })),
			"admin.users.$changes": changes,
			"admin.users.changeRole": () => Effect.void,
			"admin.users.list": () => Effect.succeed({ canChangeRoles: false, next: Option.none<string>(), users: [] }),
			"identity.sessions.$changes": changes,
			"identity.sessions.list": () => Effect.succeed({ next: Option.none(), sessions: [] }),
			"identity.sessions.revoke": () => Effect.void,
		},
		state,
	};
}

export function failedJob(id: string) {
	return {
		attempt: 2,
		completedOn: Option.some(DateTime.makeUnsafe("2026-10-25T11:00:00Z")),
		createdOn: DateTime.makeUnsafe("2026-10-25T10:00:00Z"),
		data: { noteId: 42 },
		id,
		output: { _tag: "Error", message: "Worker unavailable" },
		queue: "count-note-words",
		retryCount: 1,
		retryLimit: 1,
		startedOn: Option.some(DateTime.makeUnsafe("2026-10-25T10:59:00Z")),
		state: "failed" as const,
	};
}
