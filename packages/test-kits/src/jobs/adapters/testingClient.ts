import { Effect } from "effect";
import type { ClientUpdateOptions, ClientUpdateRequest, ClientUpdateResult, PgBossClient } from "@shivaedev/jobs/server/adapters/client.ts";
import type { EngineClient } from "@shivaedev/jobs/server/engineClient.ts";
import type { EnqueueOptions } from "@shivaedev/jobs/server/enqueueOptions.ts";
import type { WorkerJob } from "@shivaedev/jobs/server/job.ts";
import { testingEngine } from "#jobs/adapters/testingEngine.ts";
import { testingExpirations } from "#jobs/adapters/testingExpirations.ts";
import type { TestingBatch, TestingWork } from "#jobs/testingIdle.ts";

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
			if (options?.deadLetter !== undefined) {
				controls.work.queues.add(name);
			}
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
		update,
		updateQueue: (name, options) =>
			client.updateQueue(name, {
				...options,
				...controls.retryPolicy,
				...(controls.retryPolicy.retryBackoff === false ? { retryDelayMax: null } : {}),
			}),
		work: async (name, options, handler) =>
			client.work(name, options, async (jobs: readonly WorkerJob<unknown>[]) => {
				const batch: TestingBatch = { jobs: new Map(jobs.map((job) => [job.id, job.retryCount])), name, settled: false };
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
			}),
	};
	const wrapped = new Proxy(client, {
		get(target, property) {
			if (Object.hasOwn(overrides, property)) {
				const override: unknown = Reflect.get(overrides, property);
				return override;
			}
			const value: unknown = Reflect.get(target, property);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
	return wrapped;
}
