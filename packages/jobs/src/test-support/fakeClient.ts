import { EventEmitter } from "node:events";
import { Clock, Effect } from "effect";
import type {
	FindJobsOptions,
	Job,
	JobAttempt,
	JobWithMetadata,
	Queue,
	QueueResult,
	ScheduleOptions,
	SendOptions,
	StopOptions,
	UpdateOptions,
	UpdateQueueOptions,
	UpdateRequest,
	UpdateResponse,
	WorkOptions,
} from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { failureOf } from "#test/failureOf.ts";
import { queueResult } from "#test/runtime/queueResult.ts";

interface WorkerCall {
	readonly name: string;
	readonly options: WorkOptions;
	readonly run: (jobs: readonly Job<unknown>[]) => Promise<unknown>;
}

function idsOf(target: JobAttempt | string | JobAttempt[] | string[]): string[] {
	return (Array.isArray(target) ? target : [target]).map((entry) => (typeof entry === "string" ? entry : entry.id));
}

export class FakeClient implements PgBossClient {
	readonly calls: string[] = [];
	readonly created: Array<{ readonly name: string; readonly options?: Omit<Queue, "name"> | undefined }> = [];
	readonly updated: Array<{ readonly name: string; readonly options: UpdateQueueOptions }> = [];
	readonly scheduled: Array<{ readonly cron: string; readonly name: string; readonly options?: ScheduleOptions | undefined }> = [];
	readonly sent: Array<{ readonly data?: object | null | undefined; readonly name: string; readonly options?: SendOptions | undefined }> = [];
	readonly settled: string[] = [];
	readonly workers: WorkerCall[] = [];
	readonly errors = new EventEmitter();
	readonly queues = new Map<string, QueueResult>();
	readonly stored = new Map<string, JobWithMetadata<unknown>>();
	readonly createQueueFailures: unknown[] = [];
	readonly deliverOnWork = new Map<string, unknown>();
	creationAttempts = 0;
	claimReads = 0;
	stallsClaimReads = false;
	startFailure: unknown;
	stopFailure: unknown;
	starting: Promise<void> | undefined;
	duringStart: (() => void) | undefined;
	duringStop: (() => void) | undefined;

	complete(name: string, target: JobAttempt | string | JobAttempt[] | string[]) {
		for (const id of idsOf(target)) {
			this.settled.push(`${id} completed`);
		}
		this.calls.push(`complete ${name}`);
		return Promise.resolve({ affected: 1, jobs: [], requested: 1 });
	}
	fail(name: string, target: JobAttempt | string | JobAttempt[] | string[], error: unknown) {
		for (const id of idsOf(target)) {
			this.settled.push(`${id} failed with ${failureOf(error)}`);
		}
		this.calls.push(`fail ${name}`);
		return Promise.resolve({ affected: 1, jobs: [], requested: 1 });
	}
	createQueue(name: string, options?: Omit<Queue, "name">) {
		this.creationAttempts += 1;
		const failure = this.createQueueFailures.shift();
		if (failure !== undefined) {
			return Promise.reject(failure);
		}
		this.calls.push(`create queue ${name}`);
		this.created.push({ name, options });
		if (!this.queues.has(name)) {
			this.queues.set(name, queueResult(name, { ...options }));
		}
		return Promise.resolve();
	}
	updateQueue(name: string, options: UpdateQueueOptions) {
		this.calls.push(`update queue ${name}`);
		this.updated.push({ name, options });
		const existing = this.queues.get(name);
		if (existing !== undefined) {
			Object.assign(existing, options);
		}
		return Promise.resolve();
	}
	getQueue(name: string) {
		return Promise.resolve(this.queues.get(name) ?? null);
	}
	findJobs(name: string, options?: FindJobsOptions) {
		this.claimReads += 1;
		if (this.stallsClaimReads) {
			return new Promise<readonly JobWithMetadata<unknown>[]>(() => undefined);
		}
		const jobs = [...this.stored.values()].filter((stored) => stored.name === name && (options?.id === undefined || stored.id === options.id));
		return Promise.resolve(jobs);
	}
	offWork(name: string) {
		this.calls.push(`stop working ${name}`);
		return Promise.resolve();
	}
	on(event: "error", listener: (error: Error) => void) {
		this.errors.on(event, listener);
		return this;
	}
	off(event: "error", listener: (error: Error) => void) {
		this.errors.off(event, listener);
		return this;
	}
	schedule(name: string, cron: string, _data?: object | null, options?: ScheduleOptions) {
		this.calls.push(`schedule ${name}`);
		this.scheduled.push({ cron, name, options });
		return Promise.resolve();
	}
	send(name: string, data?: object | null, options?: SendOptions) {
		this.calls.push(`send ${name}`);
		this.sent.push({ data, name, options });
		return Promise.resolve(`${name}-job-${this.sent.length}`);
	}
	async start() {
		this.calls.push("start");
		this.duringStart?.();
		await this.starting;
		if (this.startFailure !== undefined) {
			throw this.startFailure;
		}
		return this;
	}
	stop(_options?: StopOptions) {
		this.calls.push("stop");
		this.duringStop?.();
		return this.stopFailure === undefined ? Promise.resolve() : Promise.reject(this.stopFailure);
	}
	retry(name: string, id: string | string[]) {
		this.calls.push(`retry ${name} ${String(id)}`);
		return Promise.resolve({ affected: 1, jobs: [], requested: 1 });
	}
	update(request: UpdateRequest): Promise<UpdateResponse>;
	update(name: string, data: object | null | undefined, options?: UpdateOptions): Promise<UpdateResponse>;
	update(request: string | UpdateRequest, _data?: object | null, options?: UpdateOptions): Promise<UpdateResponse> {
		const name = typeof request === "string" ? request : request.name;
		const target = typeof request === "string" ? options : request.options;
		this.calls.push(`update ${name} ${String(target?.id)}`);
		return Promise.resolve({ jobs: [], updated: 1 });
	}
	async work(name: string, options: WorkOptions, run: (jobs: readonly Job<unknown>[]) => Promise<unknown>) {
		this.calls.push(`work ${name}`);
		this.workers.push({ name, options, run });
		if (this.deliverOnWork.has(name)) {
			const delivered: Job<unknown> & { readonly startedOn: Date } = {
				data: this.deliverOnWork.get(name),
				expireInSeconds: 900,
				heartbeatSeconds: null,
				id: `${name}-delivered-on-work`,
				name,
				retryCount: 0,
				signal: new AbortController().signal,
				startedOn: new Date(Effect.runSync(Clock.currentTimeMillis)),
			};
			await run([delivered]);
		}
		return `worker-${name}`;
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
