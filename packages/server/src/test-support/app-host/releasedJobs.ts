import { type Context, Deferred, Duration, Effect, Exit, Fiber, Layer, Logger, Option, Schema, Scope } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import type { PgBossClient } from "@shivaedev/jobs/server/adapters/client.ts";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { JobsClientFactory } from "@shivaedev/jobs/server/JobsClientFactory.ts";
import { pgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import { makePgBoss, pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { hostTime } from "@shivaedev/test-kits/host/time.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appHost } from "#appDatabase.ts";
import { migrationLoader } from "#test/app-host/migrationLoader.ts";
import { Ping, pingHandlers } from "#test/app-host/ping.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";

const Work = defineQueue({ name: "host.work", schema: Schema.Struct({ id: Schema.String }), worker: { pollingIntervalSeconds: 0.5 } });
const HostJobs = makePgBoss("@shivaedev/server/test/HostJobs");
const RELEASE_CHECK = Duration.minutes(1);

interface Job {
	readonly finished: Deferred.Deferred<string>;
	readonly gate?: Deferred.Deferred<void>;
	readonly started: Deferred.Deferred<string>;
}

interface RunningHost {
	readonly client: () => PgBossClient | undefined;
	readonly context: Context.Context<Layer.Success<ReturnType<typeof hostLayer>>>;
	disposal?: Fiber.Fiber<void>;
	readonly drains: Deferred.Deferred<void>;
	readonly logs: string[];
	readonly ready: Deferred.Deferred<void>;
	releaseCheck?: Fiber.Fiber<void, unknown>;
	readonly scope: Scope.Closeable;
	readonly time: Effect.Success<ReturnType<typeof hostTime>>;
	readonly url: string;
}

interface State {
	readonly database: Effect.Success<typeof PostgresTestDatabase>;
	readonly hosts: Map<string, RunningHost>;
	readonly jobs: Map<string, Job>;
	readonly lifecycle: string[];
}

function hostLayer(state: State, release: string, runsJobs: boolean, onClient: (client: PgBossClient) => void, drains: Deferred.Deferred<void>) {
	const handler = Work.handle(({ id }) =>
		Effect.gen(function* () {
			const job = jobOf(state, id);
			yield* Deferred.succeed(job.started, `the ${release} host`);
			if (job.gate !== undefined) {
				yield* Deferred.await(job.gate);
			}
			state.lifecycle.push(`${id} finished`);
			yield* Deferred.succeed(job.finished, `the ${release} host`);
		}),
	);
	const client = Layer.unwrap(
		Effect.gen(function* () {
			const factory = yield* JobsClientFactory;
			return pgBossLayer({ connectionString: state.database.url, migrate: false, schedule: false, supervise: false }).pipe(
				Layer.provide(
					Layer.succeed(JobsClientFactory, (options) => {
						const created = factory(options);
						onClient(observeDrains(created, drains));
						return created;
					}),
				),
			);
		}),
	);
	return appHost({
		config: { databaseUrl: state.database.url, port: 0 },
		group: Ping,
		handlers: pingHandlers,
		migrations: { components: [pgBossSchema()], loader: migrationLoader("host_items"), mode: "migrate", pollInterval: RELEASE_CHECK, release },
		policy: "loopback",
		postgresSettings: {},
		services: HostJobs.layer({ jobs: runsJobs ? [handler] : [Work] }).pipe(Layer.provide(client)),
	});
}

// Wraps the client's own offWork, as the jobs package's stop observers do, so a story sees a drain begin.
function observeDrains(client: PgBossClient, drains: Deferred.Deferred<void>) {
	const offWork = client.offWork.bind(client);
	Object.defineProperty(client, "offWork", {
		configurable: true,
		value: (...args: Parameters<PgBossClient["offWork"]>) => {
			Deferred.doneUnsafe(drains, Exit.void);
			return offWork(...args);
		},
	});
	return client;
}

function jobOf(state: State, id: string) {
	const job = state.jobs.get(id);
	if (job === undefined) {
		throw new Error(`No story job named ${id}`);
	}
	return job;
}

const startHost = Effect.fnUntraced(function* (state: State, release: string, runsJobs: boolean) {
	const scope = yield* Scope.fork(yield* Scope.Scope);
	const logs: string[] = [];
	const drains = yield* Deferred.make<void>();
	const ready = yield* Deferred.make<void>();
	const time = yield* hostTime();
	let client: PgBossClient | undefined;
	const recorder = Logger.make(({ message }) => {
		const line = (Array.isArray(message) ? message : [message]).map(String).join(" ");
		logs.push(line);
		if (line === "Worker ready to take jobs") {
			Deferred.doneUnsafe(ready, Exit.void);
		}
	});
	const context = yield* Layer.buildWithScope(
		hostLayer(
			state,
			release,
			runsJobs,
			(created) => {
				client = created;
			},
			drains,
		).pipe(Layer.provide([time.layer, Logger.layer([recorder])])),
		scope,
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die(new Error("The host must listen on TCP"));
	}
	const host: RunningHost = { client: () => client, context, drains, logs, ready, scope, time, url: `http://127.0.0.1:${server.address.port}` };
	state.hosts.set(release, host);
});

function hostOf(state: State, release: string) {
	const host = state.hosts.get(release);
	if (host === undefined) {
		throw new Error(`The ${release} host has not started`);
	}
	return host;
}

const enqueue = Effect.fnUntraced(function* (state: State, release: string, id: string, held: boolean) {
	const job: Job = {
		finished: yield* Deferred.make<string>(),
		started: yield* Deferred.make<string>(),
		...(held ? { gate: yield* Deferred.make<void>() } : {}),
	};
	state.jobs.set(id, job);
	yield* HostJobs.use((jobs) => jobs.enqueue(Work, { id })).pipe(Effect.provideContext(hostOf(state, release).context), Effect.orDie);
	return job;
});

export const releasedJobs = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	*create(): Effect.fn.Return<State, never, PostgresTestDatabase> {
		return { database: yield* PostgresTestDatabase, hosts: new Map(), jobs: new Map(), lifecycle: [] };
	},
	layer: postgres,
	name: "jobs in the application host",
	runIf: databaseUrl !== undefined,
	stages: ["hosts"],
	verbs: (state, story) => ({
		heldJobFinishes: (id: string) => {
			story.tell(`${id} is let go and finishes`);
			return Effect.gen(function* () {
				const gate = jobOf(state, id).gate;
				if (gate === undefined) {
					return yield* Effect.die(new Error(`${id} is not held`));
				}
				yield* Deferred.succeed(gate, undefined);
				yield* Deferred.await(jobOf(state, id).finished);
			});
		},
		hostDisposal: (release: string) =>
			Effect.suspend(() => {
				const disposal = hostOf(state, release).disposal;
				return disposal === undefined ? Effect.succeed("not disposing") : Effect.as(Fiber.join(disposal), "disposed");
			}),
		hostIsDisposed: (release: string) => {
			story.tell(`the ${release} host is disposed and starts draining its worker`);
			return Effect.gen(function* () {
				const host = hostOf(state, release);
				host.disposal = yield* Scope.close(host.scope, Exit.void).pipe(
					Effect.andThen(Effect.sync(() => state.lifecycle.push(`the ${release} host disposed`))),
					Effect.forkDetach,
				);
				yield* Deferred.await(host.drains);
			});
		},
		hostStarts: (release: string, options: { readonly runsJobs?: boolean } = {}) => {
			story.tell(
				`a host of release ${release} starts in migrate mode${options.runsJobs === false ? " with only the queue definition" : " with a queue worker"}`,
			);
			return startHost(state, release, options.runsJobs !== false);
		},
		httpAnswer: (release: string) =>
			Effect.tryPromise(() => fetch(`${hostOf(state, release).url}/health`)).pipe(
				Effect.match({ onFailure: () => "refuses connections", onSuccess: (response) => (response.ok ? "answers" : `answers ${response.status}`) }),
			),
		jobIsEnqueued: (release: string, id: string) => {
			story.tell(`the ${release} host enqueues ${id}`);
			return Effect.asVoid(enqueue(state, release, id, false));
		},
		jobRanOn: (id: string) =>
			Deferred.await(jobOf(state, id).finished).pipe(
				Effect.timeoutOrElse({ duration: "10 seconds", orElse: () => Effect.die(new Error(`${id} never ran`)) }),
			),
		jobRunsHeld: (release: string, id: string) => {
			story.tell(`${id} is enqueued and held in its handler`);
			return Effect.gen(function* () {
				const job = yield* enqueue(state, release, id, true);
				return yield* Deferred.await(job.started);
			});
		},
		jobState: (id: string) =>
			Effect.gen(function* () {
				const job = jobOf(state, id);
				const finished = yield* Deferred.poll(job.finished);
				if (Option.isSome(finished)) {
					return `ran on ${yield* finished.value}`;
				}
				const started = yield* Deferred.poll(job.started);
				return Option.isSome(started) ? `running on ${yield* started.value}` : "waiting";
			}),
		lifecycle: () => Effect.sync(() => [...state.lifecycle]),
		readinessLines: (release: string) => Effect.sync(() => hostOf(state, release).logs.filter((line) => line.startsWith("Worker "))),
		readinessOnceTakingJobs: (release: string) =>
			Effect.suspend(() => {
				const host = hostOf(state, release);
				return Deferred.await(host.ready).pipe(
					Effect.timeoutOrElse({ duration: "10 seconds", orElse: () => Effect.die(new Error(`The ${release} host never took jobs`)) }),
					Effect.andThen(Effect.sync(() => host.logs.filter((line) => line.startsWith("Worker ")))),
				);
			}),
		releaseCheckCompletes: (release: string) =>
			Effect.suspend(() => {
				const check = hostOf(state, release).releaseCheck;
				return check === undefined ? Effect.die(new Error(`No release check of the ${release} host is running`)) : Fiber.join(check);
			}),
		releaseCheckPasses: (release: string) => {
			story.tell(`a release check interval passes for the ${release} host`);
			return Effect.suspend(() => hostOf(state, release).time.timePasses(RELEASE_CHECK));
		},
		releaseCheckStarts: (release: string) => {
			story.tell(`a release check interval passes for the ${release} host, which starts draining its worker`);
			return Effect.gen(function* () {
				const host = hostOf(state, release);
				host.releaseCheck = yield* Effect.forkScoped(host.time.timePasses(RELEASE_CHECK));
				yield* Deferred.await(host.drains);
			});
		},
		releaseLines: (release: string) => Effect.sync(() => hostOf(state, release).logs.filter((line) => line.startsWith("Workers"))),
		workingQueues: (release: string) =>
			Effect.sync(() => [...new Set((hostOf(state, release).client()?.getWipData?.() ?? []).map((worker) => worker.name))]),
	}),
});
