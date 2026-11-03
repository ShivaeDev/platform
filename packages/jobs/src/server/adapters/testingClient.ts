import { Effect } from "effect";
import { testingEngine } from "#server/adapters/testingEngine.ts";
import { testingExpirations } from "#server/adapters/testingExpirations.ts";
import type { ClientUpdateOptions, ClientUpdateRequest, ClientUpdateResult, PgBossClient } from "#server/client.ts";
import type { EngineClient } from "#server/engineClient.ts";
import type { EnqueueOptions } from "#server/enqueueOptions.ts";
import { deferralObservers } from "#server/internal/deferral.ts";
import type { TestingBatch, TestingWork } from "#server/internal/testingIdle.ts";
import { testingRegistration } from "#server/internal/testingRegistrations.ts";
import type { WorkerJob } from "#server/job.ts";

export interface TestingControls {
	readonly changed: () => void;
	readonly expirations: Map<string, number>;
	readonly expirySeconds: Map<string, number>;
	readonly failures: Set<string>;
	readonly retryPolicy: Pick<EnqueueOptions, "retryBackoff" | "retryDelay">;
	readonly work: TestingWork;
}

export function testingClient(client: EngineClient, schema: string, controls: TestingControls): EngineClient {
	const engine = testingEngine(client, schema);
	const settlements = Effect.runSync(
		engine.observeSettlements((name) => {
			for (const batch of controls.work.batches) {
				if (batch.name === name) {
					batch.settled = true;
				}
			}
			controls.changed();
		}),
	);
	const expirations = testingExpirations(client);
	function update(request: ClientUpdateRequest): Promise<ClientUpdateResult>;
	function update(name: string, data: object | null | undefined, options?: ClientUpdateOptions): Promise<ClientUpdateResult>;
	async function update(request: string | ClientUpdateRequest, data?: object | null, options?: ClientUpdateOptions): Promise<ClientUpdateResult> {
		const result = typeof request === "string" ? await client.update(request, data, options) : await client.update(request);
		controls.changed();
		return result;
	}
	const overrides: Partial<PgBossClient> = {
		complete: async (...args) => {
			const result = await client.complete(...args);
			controls.changed();
			return result;
		},
		createQueue: (name, options) => {
			const { retryDelayMax, ...rest } = options ?? {};
			return client.createQueue(name, {
				...rest,
				...(controls.retryPolicy.retryBackoff === false || retryDelayMax === undefined ? {} : { retryDelayMax }),
				...controls.retryPolicy,
			});
		},
		fail: async (...args) => {
			const result = await client.fail(...args);
			controls.changed();
			return result;
		},
		retry: async (...args) => {
			const result = await client.retry(...args);
			controls.changed();
			return result;
		},
		send: async (name, data, options) => {
			if (controls.failures.delete(name)) {
				throw new Error("Injected pg-boss send failure");
			}
			const attempts = controls.expirations.get(name);
			const expireInSeconds = controls.expirySeconds.get(name);
			const { retryDelayMax, ...rest } = options ?? {};
			const id = await expirations.send(
				name,
				data,
				{
					...rest,
					...(controls.retryPolicy.retryBackoff === false || retryDelayMax === undefined ? {} : { retryDelayMax }),
					...controls.retryPolicy,
					...(attempts === undefined ? {} : { retryLimit: attempts - 1 }),
					...(expireInSeconds === undefined ? {} : { expireInSeconds }),
				},
				attempts,
			);
			controls.changed();
			return id;
		},
		stop: async (options) => {
			try {
				await client.stop(options);
			} finally {
				await Effect.runPromise(settlements.close);
			}
		},
		update,
		updateQueue: (name, options) =>
			client.updateQueue(name, {
				...options,
				...controls.retryPolicy,
				...(controls.retryPolicy.retryBackoff === false ? { retryDelayMax: null } : {}),
			}),
		work: async (name, options, handler) => {
			await Effect.runPromise(settlements.watch(name));
			return client.work(name, options, async (jobs: readonly WorkerJob<unknown>[]) => {
				const batch: TestingBatch = { name, settled: false };
				controls.work.batches.add(batch);
				controls.changed();
				try {
					const ready: WorkerJob<unknown>[] = [];
					for (const job of jobs) {
						const attempts = await expirations.attemptsFor(job);
						if (attempts !== undefined && job.retryCount + 1 >= attempts) {
							await Effect.runPromise(engine.expireAttempt(job));
						} else {
							ready.push(job);
						}
					}
					if (ready.length > 0) {
						await handler(ready);
					}
				} finally {
					controls.work.batches.delete(batch);
					controls.changed();
				}
			});
		},
	};
	const wrapped = new Proxy(client, {
		get(target, property) {
			if (property === testingRegistration) {
				return (name: string) => controls.work.queues.add(name);
			}
			if (Object.hasOwn(overrides, property)) {
				const override: unknown = Reflect.get(overrides, property);
				return override;
			}
			const value: unknown = Reflect.get(target, property);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
	deferralObservers.set(wrapped, controls.changed);
	return wrapped;
}
