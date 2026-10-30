import { Deferred, Effect } from "effect";
import { type Job, PgBoss, type WorkOptions } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { notifyWork } from "#test/workers.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";

export function observeWakes(engine: DatabaseEngine, runtime: string, client: PgBossClient): PgBossClient {
	const notify = client.notifyWorker;
	if (notify === undefined) {
		return client;
	}
	const wakes: string[] = [];
	engine.wakes.set(runtime, wakes);
	engine.pollers.set(runtime, notify);
	Object.defineProperty(client, "notifyWorker", {
		configurable: true,
		value: (id: string) => {
			const busy = (client.getWipData?.().find((worker) => worker.id === id)?.count ?? 0) > 0;
			wakes.push(busy ? "busy worker" : "idle worker");
			return notify(id);
		},
	});
	return client;
}

// The testing client is a proxy whose stop calls the stop of the PgBoss under it, so the recorders wrap that PgBoss's own methods.
export function observeStops(engine: DatabaseEngine, client: PgBossClient): PgBossClient {
	const stop: PgBoss["stop"] = Object.getOwnPropertyDescriptor(client, "stop")?.value ?? PgBoss.prototype.stop;
	const offWork: PgBoss["offWork"] = Object.getOwnPropertyDescriptor(client, "offWork")?.value ?? PgBoss.prototype.offWork;
	Object.defineProperty(client, "stop", {
		configurable: true,
		value(this: PgBoss, options?: Parameters<PgBoss["stop"]>[0]) {
			engine.pgBossStops.push("stop");
			notifyWork(engine.work);
			return stop.call(this, options);
		},
	});
	Object.defineProperty(client, "offWork", {
		configurable: true,
		value(this: PgBoss, ...args: Parameters<PgBoss["offWork"]>) {
			engine.pgBossStops.push(`stop working ${args[0]}`);
			notifyWork(engine.work);
			return offWork.apply(this, args);
		},
	});
	return client;
}

// pg-boss returns a claimed batch in no particular order, so stories that name the job a batch reaches first sort it.
export function sortBatches(client: PgBossClient): PgBossClient {
	const sorted = {
		work(this: PgBoss, name: string, options: WorkOptions, handler: (jobs: Job<unknown>[]) => Promise<unknown>) {
			return PgBoss.prototype.work.call(this, name, options, (jobs: Job<unknown>[]) =>
				handler([...jobs].sort((left, right) => priorityOf(right) - priorityOf(left))),
			);
		},
	};
	Object.defineProperty(client, "work", { configurable: true, value: sorted.work });
	return client;
}

function priorityOf(job: Job<unknown>): number {
	return "priority" in job && typeof job.priority === "number" ? job.priority : 0;
}

export function pauseCompletion(engine: DatabaseEngine, client: PgBossClient, gate: string) {
	const db = client.getDb?.();
	if (db === undefined) {
		throw new TypeError("This pg-boss client exposes no database to pause");
	}
	const executeSql = db.executeSql.bind(db);
	let paused = false;
	db.executeSql = async (text, values) => {
		if (!paused && /SET completed_on = \S+, state = 'completed'/u.test(text.replace(/\s+/gu, " "))) {
			paused = true;
			const { entered, opened, passed } = engine.work.gate(gate);
			Deferred.doneUnsafe(entered, Effect.void);
			await Effect.runPromise(Deferred.await(opened));
			const result = await executeSql(text, values);
			Deferred.doneUnsafe(passed, Effect.void);
			return result;
		}
		return executeSql(text, values);
	};
}
