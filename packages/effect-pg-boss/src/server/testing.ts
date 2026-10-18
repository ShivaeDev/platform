import { Effect, Redacted } from "effect";
import { PgBoss } from "pg-boss";
import type { PgBossClientFactory } from "#client.ts";
import type { JobPayloadSchema, QueueDefinition } from "#definition.ts";
import { PgBossTestingError } from "#error.ts";
import { testingClient } from "#internal/testingClient.ts";
import { testingCompletions } from "#internal/testingCompletions.ts";
import { testingOperation, testingReadout } from "#internal/testingReadout.ts";
import { testingSignal } from "#internal/testingSignal.ts";

export const testRetryPolicy = Object.freeze({ retryBackoff: false, retryDelay: 0 });

export interface PgBossTestingOptions {
	readonly retryPolicy?: typeof testRetryPolicy;
}

export function makePgBossTesting(options: PgBossTestingOptions = {}) {
	let current: PgBoss | undefined;
	const signal = testingSignal();
	const controls = {
		changed: signal.changed,
		completions: testingCompletions(),
		expirations: new Map<string, number>(),
		failures: new Set<string>(),
		retryPolicy: options.retryPolicy ?? {},
	};
	function client(): PgBoss {
		if (current === undefined) {
			throw new Error("Provide the testing clientFactory to a jobs Layer first");
		}
		return current;
	}
	const clientFactory: PgBossClientFactory = (clientOptions) => {
		if (current !== undefined) {
			throw new Error("A testing controller owns one jobs client; create a controller per runtime");
		}
		current = new PgBoss({ ...clientOptions, "__test__enableSpies": true });
		return testingClient(current, clientOptions.schema ?? "pgboss", controls);
	};
	return {
		checkBatchWindow: (queue: QueueDefinition, millisecondsPerJob: number) =>
			testingOperation(
				"checkBatchWindow",
				async () => {
					const stored = await client().getQueue(queue.name);
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
				if ((await client().schemaVersion()) !== expected) {
					throw new Error(`Expected pg-boss schema version ${expected}`);
				}
			}),
		clientFactory,
		completions: controls.completions.read,
		expireAfter: (queue: QueueDefinition, attempts: number) =>
			Effect.try({
				catch: (original) => new PgBossTestingError({ operation: "expireAfter", original: Redacted.make(original), queue: queue.name }),
				try: () => {
					if (!Number.isSafeInteger(attempts) || attempts < 1) {
						throw new RangeError("Attempts must be a positive integer");
					}
					controls.expirations.set(queue.name, attempts);
				},
			}),
		failNextSend: <TName extends string, TPayload extends JobPayloadSchema>(queue: QueueDefinition<TName, TPayload>) =>
			Effect.sync(() => controls.failures.add(queue.name)).pipe(Effect.asVoid),
		jobs: testingReadout(client),
		revision: signal.revision,
		schemaVersion: testingOperation("schemaVersion", () => client().schemaVersion()),
		waitForChange: signal.waitForChange,
	};
}

export type PgBossTesting = ReturnType<typeof makePgBossTesting>;
