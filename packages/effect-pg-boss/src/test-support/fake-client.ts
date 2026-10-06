import type { ConstructorOptions, Job, Queue, QueueResult, ScheduleOptions, SendOptions, StopOptions, WorkOptions } from "pg-boss";
import type { PgBossClient } from "#client.ts";

interface QueueCall {
	readonly name: string;
	readonly options?: Omit<Queue, "name"> | undefined;
}

interface WorkerCall {
	readonly name: string;
	readonly options: WorkOptions;
	readonly run: (jobs: readonly Job<unknown>[]) => Promise<unknown>;
}

export class FakeClient implements PgBossClient {
	readonly createQueueCalls: QueueCall[] = [];
	readonly offWorkCalls: string[] = [];
	readonly scheduleCalls: Array<{
		readonly cron: string;
		readonly data?: object | null | undefined;
		readonly name: string;
		readonly options?: ScheduleOptions | undefined;
	}> = [];
	readonly sendCalls: Array<{
		readonly data?: object | null | undefined;
		readonly name: string;
		readonly options?: SendOptions | undefined;
	}> = [];
	readonly workers: WorkerCall[] = [];
	readonly errors: Array<(error: Error) => void> = [];
	readonly queues = new Map<string, QueueResult>();
	startCalls = 0;
	failStart = false;
	stopCalls = 0;
	failCreateQueue = false;

	async createQueue(name: string, options?: Omit<Queue, "name">) {
		if (this.failCreateQueue) {
			throw new Error("queue unavailable");
		}
		this.createQueueCalls.push({ name, options });
	}
	async getQueue(name: string) {
		return this.queues.get(name) ?? null;
	}
	async offWork(name: string) {
		this.offWorkCalls.push(name);
	}
	on(_event: "error", listener: (error: Error) => void) {
		this.errors.push(listener);
		return this;
	}
	off(_event: "error", listener: (error: Error) => void) {
		const index = this.errors.indexOf(listener);
		if (index >= 0) {
			this.errors.splice(index, 1);
		}
		return this;
	}
	async schedule(name: string, cron: string, data?: object | null, options?: ScheduleOptions) {
		this.scheduleCalls.push({ cron, data, name, options });
	}
	async send(name: string, data?: object | null, options?: SendOptions) {
		this.sendCalls.push({ data, name, options });
		return "job-id";
	}
	async start() {
		this.startCalls += 1;
		if (this.failStart) {
			throw new Error("start unavailable");
		}
		return this;
	}
	async stop(_options?: StopOptions) {
		this.stopCalls += 1;
	}
	async work(name: string, options: WorkOptions, run: (jobs: readonly Job<unknown>[]) => Promise<unknown>) {
		this.workers.push({ name, options, run });
		return `worker-${name}`;
	}
}

export function job(name: string, data: unknown): Job<unknown> {
	return {
		data,
		expireInSeconds: 900,
		heartbeatSeconds: null,
		id: `job-${name}`,
		name,
		signal: new AbortController().signal,
	};
}

export function queueResult(name: string, counts: Partial<QueueResult>): QueueResult {
	return {
		activeCount: 0,
		createdOn: new Date(0),
		deferredCount: 0,
		failedCount: 0,
		name,
		queuedCount: 0,
		readyCount: 0,
		singletonsActive: null,
		table: name,
		totalCount: 0,
		updatedOn: new Date(0),
		...counts,
	};
}

export const constructorOptions: ConstructorOptions = {
	connectionString: "postgresql://compile-only",
	schema: "jobs_test",
};
