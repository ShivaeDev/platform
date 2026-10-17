import { Clock, Effect } from "effect";
import type {
	ConstructorOptions,
	Job,
	JobAttempt,
	Queue,
	QueueResult,
	ScheduleOptions,
	SendOptions,
	StopOptions,
	UpdateQueueOptions,
	WorkOptions,
} from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { queueResult } from "#test/queueResult.ts";

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
	readonly completeCalls: Array<{ name: string; job: JobAttempt | string | JobAttempt[] | string[] }> = [];
	readonly failCalls: Array<{ name: string; job: JobAttempt | string | JobAttempt[] | string[]; error: unknown }> = [];
	readonly createQueueCalls: QueueCall[] = [];
	readonly updateQueueCalls: Array<{ name: string; options: UpdateQueueOptions }> = [];
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

	complete(name: string, target: JobAttempt | string | JobAttempt[] | string[]) {
		this.completeCalls.push({ job: target, name });
		return Promise.resolve({ affected: 1, jobs: [], requested: 1 });
	}
	fail(name: string, target: JobAttempt | string | JobAttempt[] | string[], error: unknown) {
		this.failCalls.push({ error, job: target, name });
		return Promise.resolve({ affected: 1, jobs: [], requested: 1 });
	}

	createQueue(name: string, options?: Omit<Queue, "name">) {
		if (this.failCreateQueue) {
			return Promise.reject(new Error("queue unavailable"));
		}
		this.createQueueCalls.push({ name, options });
		if (!this.queues.has(name)) {
			this.queues.set(name, queueResult(name, { ...options }));
		}
		return Promise.resolve();
	}
	updateQueue(name: string, options: UpdateQueueOptions) {
		this.updateQueueCalls.push({ name, options });
		const existing = this.queues.get(name);
		if (existing !== undefined) {
			Object.assign(existing, options);
		}
		return Promise.resolve();
	}
	getQueue(name: string) {
		return Promise.resolve(this.queues.get(name) ?? null);
	}
	offWork(name: string) {
		this.offWorkCalls.push(name);
		return Promise.resolve();
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
	schedule(name: string, cron: string, data?: object | null, options?: ScheduleOptions) {
		this.scheduleCalls.push({ cron, data, name, options });
		return Promise.resolve();
	}
	send(name: string, data?: object | null, options?: SendOptions) {
		this.sendCalls.push({ data, name, options });
		return Promise.resolve("job-id");
	}
	start() {
		this.startCalls += 1;
		if (this.failStart) {
			return Promise.reject(new Error("start unavailable"));
		}
		return Promise.resolve(this);
	}
	stop(_options?: StopOptions) {
		this.stopCalls += 1;
		return Promise.resolve();
	}
	work(name: string, options: WorkOptions, run: (jobs: readonly Job<unknown>[]) => Promise<unknown>) {
		this.workers.push({ name, options, run });
		return Promise.resolve(`worker-${name}`);
	}
}

export function job(name: string, data: unknown): Job<unknown> & { readonly startedOn: Date } {
	return {
		data,
		expireInSeconds: 900,
		heartbeatSeconds: null,
		id: `job-${name}`,
		name,
		retryCount: 0,
		signal: new AbortController().signal,
		startedOn: new Date(Effect.runSync(Clock.currentTimeMillis)),
	};
}

export const constructorOptions: ConstructorOptions = {
	connectionString: "postgresql://compile-only",
	schema: "jobs_test",
};
