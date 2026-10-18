import type { Job, PgBoss, SendOptions, UpdateOptions, UpdateRequest, UpdateResponse } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { deferralObservers } from "#internal/deferral.ts";
import { expireAttempt } from "#internal/expireAttempt.ts";
import { observeTestingSettlements } from "#internal/observeTestingSettlements.ts";
import { testingExpirations } from "#internal/testingExpirations.ts";

export interface TestingControls {
	readonly changed: () => void;
	readonly expirations: Map<string, number>;
	readonly failures: Set<string>;
	readonly retryPolicy: Pick<SendOptions, "retryBackoff" | "retryDelay">;
}

export function testingClient(client: PgBoss, schema: string, controls: TestingControls): PgBossClient {
	const settlements = observeTestingSettlements(client, controls.changed);
	const expirations = testingExpirations(client);
	function update(request: UpdateRequest): Promise<UpdateResponse>;
	function update(name: string, data: object | null | undefined, options?: UpdateOptions): Promise<UpdateResponse>;
	async function update(request: string | UpdateRequest, data?: object | null, options?: UpdateOptions): Promise<UpdateResponse> {
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
			const { retryDelayMax, ...rest } = options ?? {};
			const id = await expirations.send(
				name,
				data,
				{
					...rest,
					...(controls.retryPolicy.retryBackoff === false || retryDelayMax === undefined ? {} : { retryDelayMax }),
					...controls.retryPolicy,
					...(attempts === undefined ? {} : { retryLimit: attempts - 1 }),
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
				settlements.close();
			}
		},
		update,
		updateQueue: (name, options) =>
			client.updateQueue(name, {
				...options,
				...controls.retryPolicy,
				...(controls.retryPolicy.retryBackoff === false ? { retryDelayMax: null } : {}),
			}),
		work: (name, options, handler) => {
			settlements.watch(name);
			return client.work(name, options, async (jobs: Job<unknown>[]) => {
				controls.changed();
				try {
					const ready: Job<unknown>[] = [];
					for (const job of jobs) {
						const attempts = await expirations.attemptsFor(job);
						if (attempts !== undefined && job.retryCount + 1 >= attempts) {
							await expireAttempt(client, schema, job);
						} else {
							ready.push(job);
						}
					}
					if (ready.length > 0) {
						await handler(ready);
					}
				} finally {
					controls.changed();
				}
			});
		},
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
	deferralObservers.set(wrapped, controls.changed);
	return wrapped;
}
