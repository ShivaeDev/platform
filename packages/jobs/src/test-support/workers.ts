import { Clock, Context, Data, DateTime, Deferred, Duration, Effect } from "effect";
import type { JobContext, JobPayloadSchema, JobRegistration, QueueDefinition, ScheduleDefinition } from "#definition.ts";
import { RetryAt } from "#definition.ts";
import { makePgBoss, type PgBossService } from "#service.ts";

export const Jobs = makePgBoss("@test/Jobs");

export class ApplicationLog extends Context.Service<ApplicationLog, (line: string) => void>()("@test/ApplicationLog") {}

export class WorkerRejected extends Data.TaggedError("WorkerRejected")<{ readonly message: string }> {}

export type DeferralTime = "now" | "tomorrow" | { readonly afterMillis: number };

export type Attempt =
	| "succeeds"
	| "hangs"
	| "interrupts itself"
	| { readonly waitsFor: string; readonly afterwards?: Attempt }
	| { readonly waitsUntilRunning: number }
	| { readonly fails: string }
	| { readonly failsTyped: string }
	| { readonly failsWithText: string }
	| { readonly dies: string }
	| { readonly defers: string; readonly until?: DeferralTime }
	| { readonly enqueues: (jobs: PgBossService) => Effect.Effect<unknown, unknown> }
	| { readonly step: string; readonly next: Attempt }
	| "notes its job in the application log";

export interface StartedAttempt {
	readonly at: number;
	readonly budget: number;
	readonly deadline: number;
	readonly id: string;
	readonly payload: unknown;
	readonly queue: string;
}

interface Gate {
	readonly entered: Deferred.Deferred<void>;
	readonly opened: Deferred.Deferred<void>;
	readonly passed: Deferred.Deferred<void>;
}

interface Moment {
	readonly at: number;
	readonly id: string;
}

export function workLog() {
	const started: StartedAttempt[] = [];
	const finished: Moment[] = [];
	const interrupted: Moment[] = [];
	const deferrals: { readonly id: string; readonly at: DateTime.Utc }[] = [];
	const gates = new Map<string, Gate>();
	const changed = new Set<() => void>();
	const active = new Map<string, number>();
	const running = new Map<string, number>();
	const peaks = new Map<string, number>();
	const overlaps: string[] = [];
	function gate(name: string): Gate {
		const existing = gates.get(name);
		if (existing !== undefined) {
			return existing;
		}
		const created = { entered: Deferred.makeUnsafe<void>(), opened: Deferred.makeUnsafe<void>(), passed: Deferred.makeUnsafe<void>() };
		gates.set(name, created);
		return created;
	}
	return {
		active,
		attemptsOf: (queue: string) => started.filter((attempt) => attempt.queue === queue).map((attempt) => attempt.id),
		changed,
		deferrals,
		finished,
		gate,
		gates,
		handled: (queue: string) => started.filter((attempt) => attempt.queue === queue).map((attempt) => attempt.payload),
		interrupted,
		overlaps,
		peaks,
		running,
		started,
	};
}

export type WorkLog = ReturnType<typeof workLog>;

export function notifyWork(log: WorkLog) {
	for (const listener of [...log.changed]) {
		listener();
	}
}

export function untilWork<A>(log: WorkLog, read: () => A | undefined): Effect.Effect<A> {
	return Effect.callback<A>((resume) => {
		function check() {
			const value = read();
			if (value !== undefined) {
				log.changed.delete(check);
				resume(Effect.succeed(value));
			}
		}
		log.changed.add(check);
		check();
		return Effect.sync(() => log.changed.delete(check));
	});
}

function deferralTime(until: DeferralTime | undefined) {
	if (until === undefined || until === "now") {
		return Effect.succeed(DateTime.makeUnsafe(0));
	}
	const after = until === "tomorrow" ? 86_400_000 : until.afterMillis;
	return Effect.map(Clock.currentTimeMillis, (now) => DateTime.makeUnsafe(now + after));
}

type Services = ApplicationLog | Context.Service.Identifier<typeof Jobs>;

function run(attempt: Attempt, log: WorkLog, job: JobContext): Effect.Effect<unknown, unknown, Services> {
	if (attempt === "succeeds") {
		return Effect.void;
	}
	if (attempt === "hangs") {
		return Effect.never;
	}
	if (attempt === "interrupts itself") {
		return Effect.interrupt;
	}
	if (attempt === "notes its job in the application log") {
		return Effect.flatMap(ApplicationLog, (note) => Effect.sync(() => note(`${job.name} ran ${job.id}`)));
	}
	if ("waitsFor" in attempt) {
		const gate = log.gate(attempt.waitsFor);
		const waited = Deferred.succeed(gate.entered, undefined).pipe(
			Effect.andThen(Deferred.await(gate.opened)),
			Effect.andThen(Deferred.succeed(gate.passed, undefined)),
		);
		return attempt.afterwards === undefined ? waited : Effect.andThen(waited, run(attempt.afterwards, log, job));
	}
	if ("waitsUntilRunning" in attempt) {
		const company = attempt.waitsUntilRunning;
		return untilWork(log, () => ((log.peaks.get(job.name) ?? 0) >= company ? true : undefined));
	}
	if ("fails" in attempt) {
		return Effect.fail(new Error(attempt.fails));
	}
	if ("failsTyped" in attempt) {
		return Effect.fail(new WorkerRejected({ message: attempt.failsTyped }));
	}
	if ("failsWithText" in attempt) {
		return Effect.fail(attempt.failsWithText);
	}
	if ("dies" in attempt) {
		return Effect.die(new Error(attempt.dies));
	}
	if ("defers" in attempt) {
		const reason = attempt.defers;
		return Effect.flatMap(deferralTime(attempt.until), (at) =>
			Effect.sync(() => log.deferrals.push({ at, id: job.id })).pipe(Effect.andThen(Effect.fail(new RetryAt({ at, reason })))),
		);
	}
	if ("step" in attempt) {
		return run(attempt.next, log, job).pipe(Effect.withSpan(attempt.step));
	}
	return Effect.flatMap(Jobs, attempt.enqueues);
}

function attemptOf(script: readonly Attempt[], index: number): Attempt {
	return script[Math.min(index, script.length - 1)] ?? "succeeds";
}

function count(counts: Map<string, number>, key: string, by: number) {
	const next = (counts.get(key) ?? 0) + by;
	counts.set(key, next);
	return next;
}

function moment(into: Moment[], id: string) {
	return Effect.flatMap(Clock.currentTimeMillis, (at) => Effect.sync(() => into.push({ at, id })));
}

const performed = Effect.fnUntraced(function* (
	log: WorkLog,
	queue: string,
	payload: unknown,
	job: JobContext,
	choose: (index: number) => Attempt,
	perRun = false,
) {
	const at = yield* Clock.currentTimeMillis;
	const budget = Duration.toMillis(yield* job.remainingBudget);
	const index = log.started.filter((attempt) => (perRun ? attempt.queue === queue : attempt.id === job.id)).length;
	if (count(log.active, job.id, 1) > 1) {
		log.overlaps.push(job.id);
	}
	log.peaks.set(queue, Math.max(log.peaks.get(queue) ?? 0, count(log.running, queue, 1)));
	log.started.push({ at, budget, deadline: at + budget, id: job.id, payload, queue });
	notifyWork(log);
	yield* run(choose(index), log, job).pipe(
		Effect.tap(() => moment(log.finished, job.id)),
		Effect.onInterrupt(() => moment(log.interrupted, job.id)),
		Effect.ensuring(
			Effect.sync(() => {
				count(log.active, job.id, -1);
				count(log.running, queue, -1);
				notifyWork(log);
			}),
		),
	);
});

export type WorkerOf = (log: WorkLog) => JobRegistration;

export function worker<const TName extends string, const TPayload extends JobPayloadSchema>(
	queue: QueueDefinition<TName, TPayload>,
	...script: readonly Attempt[]
): WorkerOf {
	return (log) => queue.handle((payload, job) => performed(log, queue.name, payload, job, (index) => attemptOf(script, index)));
}

export function workerBy<const TName extends string, const TPayload extends JobPayloadSchema>(
	queue: QueueDefinition<TName, TPayload>,
	choose: (payload: TPayload["Type"], attempt: number) => Attempt,
): WorkerOf {
	return (log) => queue.handle((payload, job) => performed(log, queue.name, payload, job, (index) => choose(payload, index)));
}

export function scheduled<const TName extends string>(schedule: ScheduleDefinition<TName>, ...script: readonly Attempt[]): WorkerOf {
	return (log) =>
		schedule.run(
			Effect.suspend(() => {
				const job: JobContext = {
					expireInSeconds: 0,
					heartbeatSeconds: null,
					id: `run ${log.attemptsOf(schedule.name).length + 1} of ${schedule.name}`,
					name: schedule.name,
					remainingBudget: Effect.succeed(Duration.zero),
					signal: new AbortController().signal,
				};
				return performed(log, schedule.name, null, job, (index) => attemptOf(script, index), true);
			}),
		);
}

export type Registration = JobRegistration | WorkerOf;

export function registrations(log: WorkLog, jobs: readonly Registration[]): readonly JobRegistration[] {
	return jobs.map((job) => (typeof job === "function" ? job(log) : job));
}
