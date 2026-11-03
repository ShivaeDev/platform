import { Duration, Effect, Redacted, type Schema } from "effect";
import { defaultClientFactory } from "#server/adapters/defaultClientFactory.ts";
import { testingClient } from "#server/adapters/testingClient.ts";
import { testingDueNow } from "#server/adapters/testingDueNow.ts";
import type { JobReadOptions, PgBossClientFactory } from "#server/client.ts";
import type { JobPayloadSchema, QueueDefinition } from "#server/definition.ts";
import type { EngineClient } from "#server/engineClient.ts";
import { PgBossTestingError } from "#server/error.ts";
import type { PgBossInspectionService, SnapshotQueue } from "#server/inspection.ts";
import { type TestingFetches, testingFetches } from "#server/internal/adapters/testingFetches.ts";
import { type TestingWork, testingIdle } from "#server/internal/testingIdle.ts";
import { testingInspection, testingOperation } from "#server/internal/testingOperation.ts";
import { testingSchedules } from "#server/internal/testingSchedules.ts";
import { testingWaits } from "#server/internal/testingWaits.ts";
import type { PgBossTestingOptions } from "#server/testing.ts";
import { queueSignal } from "./queueSignal.ts";
import { testingInspectionClient } from "./testingInspectionClient.ts";
export function testingController(settings: PgBossTestingOptions = {}) {
	let current: EngineClient | undefined;
	let fetches: TestingFetches | undefined;
	let schema = "pgboss";
	const signal = queueSignal();
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
		current = defaultClientFactory(clientOptions);
		fetches = testingFetches(current.getDb(), signal.changed);
		current = testingClient(current, schema, controls);
		return testingInspectionClient(current, schema, work, signal.changed, (reads) => {
			observed = reads;
		});
	};
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
		waitForIdle: testingIdle(inspection, work, signal),
	};
}
