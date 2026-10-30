import { Clock, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import type { Job } from "pg-boss";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { PgBossClient } from "#client.ts";
import type { PgBossService } from "#service.ts";
import { failureOf } from "#test/failureOf.ts";
import { FakeClient } from "#test/fakeClient.ts";
import { scriptedClient } from "#test/runtime/scriptedClient.ts";
import { spanTree } from "#test/spanTree.ts";
import { type Registration, untilWork } from "#test/workers.ts";
import { described, type Fetched, type Options, provided, type RuntimeEngine, runningIn, runtimeEngine, startRuntime } from "./engine.ts";

export const runtime = storyKit({
	clock: "live",
	create: runtimeEngine,
	inspect: (engine) => ({ calls: engine.client.calls, logs: engine.logs, settled: engine.client.settled, startups: [...engine.startups] }),
	name: "jobs runtime over a recording pg-boss client",
	stages: ["client", "runtime"],
	verbs: (engine, story) => ({
		answered: () => Effect.sync(() => engine.answered),
		applicationLog: () => Effect.sync(() => [...engine.applicationLog]),
		ask: <A, E>(name: string, request: string, call: (jobs: PgBossService) => Effect.Effect<A, E>) => {
			story.tell(`${name} asks its jobs service to ${request}`);
			return Effect.suspend(() => provided(engine, call(runningIn(engine, name).jobs))).pipe(
				Effect.match({ onFailure: failureOf, onSuccess: described }),
				Effect.tap((answer) =>
					Effect.sync(() => {
						engine.answered = answer;
					}),
				),
			);
		},
		batchAnswer: () => Effect.sync(() => engine.batchAnswer),
		claimReads: () => Effect.sync(() => engine.client.claimReads),
		clientCalls: () => Effect.sync(() => [...engine.client.calls]),
		clientsConstructed: () => Effect.sync(() => engine.clientsConstructed),
		clockPasses: (millis: number) => {
			story.tell(`${millis}ms pass on the runtime clock`);
			return TestClock.adjust(millis);
		},
		createdQueues: () => Effect.sync(() => engine.client.created.map(({ name, options }) => ({ name, options }))),
		deliver: (queue: string, jobs: readonly Fetched[], { pgBossAborts }: { readonly pgBossAborts?: string } = {}) => {
			story.tell(
				`pg-boss delivers ${jobs.map((job) => job.id).join(", ")} to the ${queue} worker${pgBossAborts === undefined ? "" : ` and aborts ${pgBossAborts} once it starts`}`,
			);
			return delivered(engine, queue, jobs, pgBossAborts);
		},
		deliveryFinishes: () => {
			story.tell("the delivered batch finishes");
			return finished(engine);
		},
		deliveryReturned: () =>
			Effect.sync(
				() =>
					`${Math.floor(engine.returnedAfterDeadline / 1000)} second${Math.floor(engine.returnedAfterDeadline / 1000) === 1 ? "" : "s"} after the batch deadline`,
			),
		emitClientError: (error: Error) => {
			story.tell(`the pg-boss client emits "${error.message}"`);
			return Effect.sync(() => {
				engine.client.errors.emit("error", error);
			});
		},
		errorListeners: () => Effect.sync(() => engine.client.errors.listenerCount("error")),
		failClientStart: (message: string) => {
			story.tell(`the shared client's start fails with "${message}"`);
			return Effect.gen(function* () {
				engine.releaseStart?.(new Error(message));
				yield* finished(engine);
			});
		},
		failureMessage: (name: string) => Effect.sync(() => engine.failureMessages.get(name) ?? "no failure"),
		handled: (queue: string) => Effect.sync(() => engine.work.handled(queue)),
		interrupted: () => Effect.sync(() => engine.work.interrupted.map(({ id }) => id)),
		logged: () => Effect.sync(() => engine.logs.map(({ level, message }) => ({ level, message }))),
		queueCreationAttempts: () => Effect.sync(() => engine.client.creationAttempts),
		scheduledCrons: () => Effect.sync(() => engine.client.scheduled.map(({ cron, name, options }) => ({ cron, name, options }))),
		sent: () => Effect.sync(() => engine.client.sent.map(({ data, name, options }) => ({ data, name, options }))),
		settlements: () => Effect.sync(() => [...engine.client.settled]),
		spans: () => Effect.sync(() => spanTree(engine.trace.spans)),
		start: (name: string, jobs: readonly Registration[], options?: Options) => {
			story.tell(`${name} starts the jobs runtime`);
			return startRuntime(engine, name, jobs, options);
		},
		startedAttempts: () => Effect.sync(() => engine.work.started.map(({ budget, id }) => ({ budget, id }))),
		startsDelivering: (queue: string, job: Fetched) => {
			story.tell(`pg-boss delivers ${job.id} to the ${queue} worker, and its handler starts`);
			return Effect.gen(function* () {
				const fiber = yield* delivered(engine, queue, [job], undefined).pipe(Effect.forkChild({ startImmediately: true }));
				engine.pending.push(Fiber.join(fiber));
				yield* untilWork(engine.work, () => (engine.work.started.some((attempt) => attempt.id === job.id) ? true : undefined));
			});
		},
		startsInBackground: (name: string, jobs: readonly Registration[]) => {
			story.tell(`${name} starts the jobs runtime without waiting for it`);
			return Effect.gen(function* () {
				engine.startups.set(name, "still starting");
				const fiber = yield* startRuntime(engine, name, jobs).pipe(Effect.forkChild({ startImmediately: true }));
				engine.pending.push(Fiber.join(fiber));
			});
		},
		startTogether: (...names: readonly string[]) => {
			story.tell(`${names.join(" and ")} start the jobs runtime while the shared client is still starting`);
			return Effect.forEach(names, (name) =>
				Effect.gen(function* () {
					const fiber = yield* startRuntime(engine, name, []).pipe(Effect.forkChild({ startImmediately: true }));
					engine.pending.push(Fiber.join(fiber));
				}),
			);
		},
		startup: (name: string) => Effect.sync(() => engine.startups.get(name) ?? "never started"),
		startupFinishes: (name: string) => {
			story.tell(`${name}'s startup finishes`);
			return finished(engine);
		},
		stop: (name: string) => {
			story.tell(`${name} stops`);
			return Effect.suspend(() => runningIn(engine, name).stop).pipe(Effect.tap(() => Effect.sync(() => engine.runtimes.delete(name))));
		},
		updatedQueues: () => Effect.sync(() => engine.client.updated.map(({ name, options }) => ({ name, options }))),
		workerCalls: () => Effect.sync(() => engine.client.calls.filter((call) => call.startsWith("work ") || call.startsWith("stop working "))),
		workerOptions: () => Effect.sync(() => engine.client.workers.map(({ name, options }) => ({ name, options }))),
	}),
});

const finished = Effect.fnUntraced(function* (engine: RuntimeEngine) {
	for (const pending of engine.pending.splice(0)) {
		yield* pending;
	}
});

const delivered = Effect.fnUntraced(function* (engine: RuntimeEngine, queue: string, jobs: readonly Fetched[], pgBossAborts: string | undefined) {
	const worker = engine.client.workers.findLast((entry) => entry.name === queue);
	if (worker === undefined) {
		return yield* Effect.die(new Error(`No worker is registered for ${queue}`));
	}
	const now = yield* Clock.currentTimeMillis;
	const aborts = new Map(jobs.map((job) => [job.id, new AbortController()]));
	const batch = jobs.map((job): Job<unknown> & { readonly startedOn: Date } => ({
		data: job.data ?? {},
		expireInSeconds: job.expireInSeconds ?? 900,
		heartbeatSeconds: null,
		id: job.id,
		name: queue,
		retryCount: job.retryCount ?? 0,
		signal: aborts.get(job.id)?.signal ?? new AbortController().signal,
		startedOn: new Date(now - (job.startedMillisAgo ?? 0)),
	}));
	function abort() {
		if (pgBossAborts !== undefined && engine.work.started.some((attempt) => attempt.id === pgBossAborts)) {
			engine.work.changed.delete(abort);
			aborts.get(pgBossAborts)?.abort();
		}
	}
	engine.work.changed.add(abort);
	engine.batchAnswer = yield* Effect.tryPromise(() => worker.run(batch)).pipe(
		Effect.match({ onFailure: (error) => `rejected with ${failureOf(error.cause)}`, onSuccess: () => "returned" }),
		Effect.ensuring(Effect.sync(() => engine.work.changed.delete(abort))),
	);
	const deadline = Math.max(...batch.map((job) => job.startedOn.getTime() + job.expireInSeconds * 1000));
	engine.returnedAfterDeadline = (yield* Clock.currentTimeMillis) - deadline;
});

const started = Effect.fnUntraced(function* (engine: RuntimeEngine, name: string, jobs: readonly Registration[], options?: Options) {
	yield* startRuntime(engine, name, jobs, options);
	const answer = engine.startups.get(name);
	if (answer !== "started") {
		return yield* Effect.die(new Error(`${name} did not start: ${answer}`));
	}
});

export function running(name: string, jobs: readonly Registration[] = [], options?: Options) {
	return runtime.trait("runtime", `${name} runs the jobs runtime`, (engine) => started(engine, name, jobs, options));
}

export function stopped(name: string, jobs: readonly Registration[] = [], options?: Options) {
	return runtime.trait("runtime", `${name} ran the jobs runtime and stopped`, function* (engine) {
		yield* started(engine, name, jobs, options);
		yield* runningIn(engine, name).stop;
		engine.runtimes.delete(name);
	});
}

export function failedToStart(name: string, jobs: readonly Registration[] = []) {
	return runtime.trait("runtime", `${name} failed to start the jobs runtime`, function* (engine) {
		yield* startRuntime(engine, name, jobs);
		if (engine.startups.get(name) === "started") {
			return yield* Effect.die(new Error(`${name} was expected to fail to start`));
		}
	});
}

export function sharedClientKey() {
	return runtime.trait("client", "runtimes share one started client under one client key", (engine) => {
		engine.options = { ...engine.options, clientCacheKey: Symbol("shared") };
	});
}

export function clientFrom(client: () => PgBossClient, description: string) {
	return runtime.trait("client", description, (engine) => {
		const created = client();
		engine.factory = () => created;
	});
}

export const settlementlessClient = clientFrom(() => {
	const {
		complete: _complete,
		fail: _fail,
		...withoutSettlement
	} = scriptedClient({ createQueue: async () => undefined, getQueue: async () => null });
	return withoutSettlement;
}, "the custom pg-boss client cannot complete or fail jobs");

export const freshClientEachTime = runtime.trait("client", "each construction returns a fresh pg-boss client", (engine) => {
	engine.factory = () => {
		engine.client = engine.clientsConstructed === 1 ? engine.client : new FakeClient();
		return engine.client;
	};
});

export function clientStartFails(message: string) {
	return runtime.trait("client", `the pg-boss client's start fails with "${message}"`, (engine) => {
		engine.client.startFailure = new Error(message);
	});
}

export function clientStopFails(message: string) {
	return runtime.trait("client", `the pg-boss client's stop fails with "${message}"`, (engine) => {
		engine.client.stopFailure = new Error(message);
	});
}

export const clientStartPending = runtime.trait("client", "the pg-boss client's start has not finished yet", (engine) => {
	engine.client.starting = new Promise((_resolve, reject) => {
		engine.releaseStart = reject;
	}).then(() => undefined);
	engine.client.starting.catch(() => undefined);
});

export function queueCreationFails(description: string, ...failures: readonly unknown[]) {
	return runtime.trait("client", description, (engine) => {
		engine.client.createQueueFailures.push(...failures);
	});
}

export function existingQueue(name: string, settings: Parameters<FakeClient["queues"]["set"]>[1]) {
	return runtime.trait("client", `pg-boss already holds the ${name} queue`, (engine) => {
		engine.client.queues.set(name, settings);
	});
}

export function storedJob(job: Parameters<FakeClient["stored"]["set"]>[1]) {
	return runtime.trait("client", `pg-boss stores job ${job.id} in state ${job.state}`, (engine) => {
		engine.client.stored.set(job.id, job);
	});
}

export const deferralWritesFail = runtime.trait("client", "the deferral store rejects every write", (engine) => {
	Object.assign(engine.client, {
		getDb: () => ({
			executeSql: (text: string) =>
				text.includes("WITH claimed AS MATERIALIZED") ? Promise.reject(new Error("deferral storage unavailable")) : Promise.resolve({ rows: [] }),
		}),
	});
});

export const claimReadsStall = runtime.trait("client", "pg-boss never answers reads of a claimed job", (engine) => {
	engine.client.stallsClaimReads = true;
});

export function deliveredWhileRegistering(queue: string, data: unknown) {
	return runtime.trait("client", `pg-boss delivers a ${queue} job while its worker is still registering`, (engine) => {
		engine.client.deliverOnWork.set(queue, data);
	});
}

export function connectionTerminatedDuring(phase: "startup" | "shutdown") {
	return runtime.trait("client", `PostgreSQL terminates a pg-boss connection during ${phase}`, (engine) => {
		function emit() {
			engine.client.errors.emit("error", connectionTerminated());
		}
		if (phase === "startup") {
			engine.client.duringStart = emit;
		} else {
			engine.client.duringStop = emit;
		}
	});
}

export const errorsReported = runtime.trait("client", "the application reports pg-boss client errors through onError", (engine) => {
	engine.reporting = true;
});

export function connectionTerminated(): Error {
	return Object.assign(new Error("terminating connection due to administrator command: password=client-secret"), { code: "57P01" });
}
