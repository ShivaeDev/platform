import { Duration, Effect, Redacted, type Schema } from "effect";
import { TestClock as PgBossTestClock } from "pg-boss";
import type { JobReadOptions, PgBossClientFactory } from "@shivaedev/jobs/server/adapters/client.ts";
import { defaultClientFactory } from "@shivaedev/jobs/server/adapters/defaultClientFactory.ts";
import type { JobPayloadSchema, QueueDefinition } from "@shivaedev/jobs/server/definition.ts";
import type { EngineClient } from "@shivaedev/jobs/server/engineClient.ts";
import type { PgBossInspectionService, SnapshotQueue } from "@shivaedev/jobs/server/inspection.ts";
import { testingClient } from "#jobs/adapters/testingClient.ts";
import { testingDueNow } from "#jobs/adapters/testingDueNow.ts";
import { type TestingFetches, testingFetches } from "#jobs/adapters/testingFetches.ts";
import { testingInspectionClient } from "#jobs/adapters/testingInspectionClient.ts";
import { testingSignal } from "#jobs/adapters/testingSignal.ts";
import { testingTime } from "#jobs/adapters/testingTime.ts";
import { PgBossTestingError } from "#jobs/error.ts";
import type { PgBossTestingOptions } from "#jobs/testing.ts";
import { type TestingWork, testingIdle } from "#jobs/testingIdle.ts";
import { testingInspection, testingOperation } from "#jobs/testingOperation.ts";
import { testingSchedules } from "#jobs/testingSchedules.ts";
import { testingWaits } from "#jobs/testingWaits.ts";
export function testingController(settings: PgBossTestingOptions = {}) {
	const clock = settings.clock === undefined ? undefined : new PgBossTestClock(settings.clock.currentTimeMillisUnsafe());
	let current: EngineClient | undefined;
	let fetches: TestingFetches | undefined;
	let schema = "pgboss";
	const signal = testingSignal();
	let observed: PgBossInspectionService | undefined;
	const work: TestingWork = { batches: new Set(), queues: new Set() };
	const controls = {
		changed: signal.changed,
		expirations: new Map<string, number>(),
		expirySeconds: new Map<string, number>(),
		failures: new Set<string>(),
		retryPolicy: settings.retryPolicy ?? {},
		work,
	};
	function client(): EngineClient {
		if (current === undefined) {
			throw new Error("Provide the testing clientFactory to a jobs Layer first");
		}
		return current;
	}
	function inspection(): PgBossInspectionService {
		if (observed === undefined) {
			throw new Error("Provide the testing clientFactory to a jobs Layer first");
		}
		return observed;
	}
	const clientFactory: PgBossClientFactory = (clientOptions) => {
		if (current !== undefined) {
			throw new Error("A testing controller owns one jobs client; create a controller per runtime");
		}
		schema = clientOptions.schema ?? "pgboss";
		current = defaultClientFactory({ ...clientOptions, ...(clock === undefined ? {} : { clock }) });
		fetches = testingFetches(current.getDb(), signal.changed);
		current = testingClient(current, schema, controls);
		return testingInspectionClient(current, schema, work, signal.changed, (reads, changes) => {
			observed = reads;
			signal.observe(changes);
		});
	};
	const wake = Effect.sync(() => {
		if (clock !== undefined) {
			for (const worker of client().getWipData()) {
				client().notifyWorker(worker.id);
			}
		}
	});
	const idle = testingIdle(inspection, work, signal, wake);
	return {
		deferred: (queue: Pick<QueueDefinition, "name">) => Effect.suspend(() => testingInspection("deferred", inspection().deferred(queue), queue.name)),
		...testingDueNow(client, () => schema, signal.changed),
		...testingSchedules(client, inspection),
		...testingWaits(inspection, () => fetches, signal),
		checkBatchWindow: (queue: Pick<QueueDefinition, "name" | "workerOptions">, millisecondsPerJob: number) =>
			testingOperation(
				"checkBatchWindow",
				async () => {
					const stored = await Effect.runPromise(inspection().queue(queue));
					if (stored === null) {
						throw new Error("Queue is not registered");
					}
					if (stored.expireInSeconds === undefined) {
						throw new Error("Queue has no expiry window");
					}
					if (!Number.isFinite(millisecondsPerJob) || millisecondsPerJob < 0) {
						throw new RangeError("Job duration must be nonnegative and finite");
					}
					const required = (queue.workerOptions.batchSize ?? 10) * millisecondsPerJob;
					if (required >= stored.expireInSeconds * 1000) {
						throw new Error("Sequential batch work must fit within the queue expiry window");
					}
				},
				queue.name,
			),
		checkSchemaVersion: (expected: number) =>
			testingOperation("checkSchemaVersion", async () => {
				if ((await Effect.runPromise(inspection().schemaVersion())) !== expected) {
					throw new Error(`Expected pg-boss schema version ${expected}`);
				}
			}),
		clientFactory,
		expireAfter: (queue: Pick<QueueDefinition, "name">, attempts: number) =>
			Effect.try({
				catch: (original) => new PgBossTestingError({ operation: "expireAfter", original: Redacted.make(original), queue: queue.name }),
				try: () => {
					if (!Number.isSafeInteger(attempts) || attempts < 1) {
						throw new RangeError("Attempts must be a positive integer");
					}
					controls.expirations.set(queue.name, attempts);
				},
			}),
		expireIn: (queue: Pick<QueueDefinition, "name">, duration: Duration.Input) =>
			Effect.try({
				catch: (original) => new PgBossTestingError({ operation: "expireIn", original: Redacted.make(original), queue: queue.name }),
				try: () => {
					const milliseconds = Duration.toMillis(Duration.fromInputUnsafe(duration));
					if (!Number.isFinite(milliseconds) || milliseconds < 1000) {
						throw new RangeError("Expiry must be finite and at least one second");
					}
					controls.expirySeconds.set(queue.name, Math.ceil(milliseconds / 1000));
				},
			}),
		failNextSend: (queue: Pick<QueueDefinition, "name">) => Effect.sync(() => controls.failures.add(queue.name)).pipe(Effect.asVoid),
		jobs: <TName extends string, TPayload extends JobPayloadSchema | typeof Schema.Null>(
			queue: { readonly name: TName; readonly schema: TPayload },
			readOptions?: JobReadOptions,
		) => Effect.suspend(() => testingInspection("jobs", inspection().jobs(queue, readOptions), queue.name)),
		refreshQueueStats: (queue?: Pick<QueueDefinition, "name">) =>
			testingOperation("refreshQueueStats", () => client().supervise(queue?.name), queue?.name),
		revision: signal.revision,
		schemaVersion: Effect.suspend(() => testingInspection("schemaVersion", inspection().schemaVersion())),
		snapshot: <const TQueues extends readonly SnapshotQueue[]>(queues: TQueues) =>
			Effect.suspend(() => testingInspection("snapshot", inspection().snapshot(queues))),
		waitForChange: signal.waitForChange,
		waitForIdle: idle,
		...testingTime(settings.clock, clock, idle),
	};
}
