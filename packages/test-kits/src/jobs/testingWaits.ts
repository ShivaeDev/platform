import { Duration, Effect, Option, Redacted, type Schema } from "effect";
import type { JobPayloadSchema, QueueDefinition } from "@shivaedev/jobs/server/definition.ts";
import type { PgBossPayloadError } from "@shivaedev/jobs/server/error.ts";
import type { PgBossInspectionService } from "@shivaedev/jobs/server/inspection.ts";
import type { Job, JobState } from "@shivaedev/jobs/server/job.ts";
import type { TestingFetches } from "#jobs/adapters/testingFetches.ts";
import { PgBossTestingError, PgBossWaitError } from "#jobs/error.ts";
import type { PgBossTestingWaitOptions } from "#jobs/testing.ts";
import { testingInspection } from "#jobs/testingOperation.ts";

interface Reading<A> {
	readonly arrived: Option.Option<A>;
	readonly seen: string;
}

interface Signal {
	readonly revision: Effect.Effect<number>;
	readonly waitForChange: (after: number) => Effect.Effect<number>;
}

function waitUntil<A, E, R>(
	signal: Signal,
	waitingFor: string,
	read: Effect.Effect<Reading<A>, E, R>,
	options: PgBossTestingWaitOptions | undefined,
) {
	const within = Duration.fromInputUnsafe(options?.within ?? "20 seconds");
	return Effect.suspend(() => {
		let lastSeen = "nothing yet";
		const wait = Effect.gen(function* () {
			while (true) {
				const revision = yield* signal.revision;
				const { arrived, seen } = yield* read;
				lastSeen = seen;
				if (Option.isSome(arrived)) {
					return arrived.value;
				}
				yield* signal.waitForChange(revision);
			}
		});
		return wait.pipe(Effect.timeoutOrElse({ duration: within, orElse: () => Effect.fail(new PgBossWaitError({ lastSeen, waitingFor, within })) }));
	});
}

function fetchesRefused(queue: Pick<QueueDefinition, "name">, original: Error) {
	return new PgBossTestingError({ operation: "fetchesPass", original: Redacted.make(original), queue: queue.name });
}

export function testingWaits(inspection: () => PgBossInspectionService, fetches: () => TestingFetches | undefined, signal: Signal) {
	return {
		fetchesPass: (queue: Pick<QueueDefinition, "name">, count: number, options?: PgBossTestingWaitOptions) =>
			Effect.gen(function* () {
				if (!Number.isSafeInteger(count) || count < 1) {
					return yield* fetchesRefused(queue, new RangeError("Fetch count must be a positive integer"));
				}
				const observed = fetches();
				if (observed === undefined) {
					return yield* fetchesRefused(queue, new Error("Provide the testing clientFactory to a jobs Layer first"));
				}
				const begun = observed.begun(queue.name);
				const fetchesHave = count === 1 ? "fetch that began after the wait has" : "fetches that began after the wait have";
				return yield* waitUntil(
					signal,
					`${count} ${queue.name} ${fetchesHave} finished`,
					Effect.sync(() => {
						const passed = observed.passedSince(queue.name, begun);
						return { arrived: passed >= count ? Option.some(undefined) : Option.none(), seen: `${passed} finished` };
					}),
					options,
				);
			}),
		untilJob: <TName extends string, TPayload extends JobPayloadSchema | typeof Schema.Null>(
			queue: { readonly name: TName; readonly schema: TPayload },
			id: string,
			state: JobState,
			options?: PgBossTestingWaitOptions,
		) =>
			waitUntil(
				signal,
				`job ${id} in ${queue.name} is ${state}`,
				Effect.suspend(() => testingInspection("untilJob", inspection().jobs(queue, { id }), queue.name)).pipe(
					Effect.flatMap(([job]): Effect.Effect<Reading<Job<TPayload["Type"]>>, PgBossPayloadError, TPayload["DecodingServices"]> => {
						if (job === undefined) {
							return Effect.succeed({ arrived: Option.none(), seen: "no such job" });
						}
						if (job.state !== state) {
							return Effect.succeed({ arrived: Option.none(), seen: job.state });
						}
						return Effect.succeed({ arrived: Option.some(job), seen: job.state });
					}),
				),
				options,
			),
	};
}
