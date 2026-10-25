import { Clock, Effect } from "effect";
import type { JobWithMetadata, PgBoss } from "pg-boss";
import type { PgBossClient } from "#client.ts";

interface ProbeOptions {
	readonly readout?: "stale" | "stalled";
	readonly waitForFirstExpiry?: boolean;
}

export function settlementProbe(client: PgBoss, options: ProbeOptions = {}) {
	const abort = new AbortController();
	const fetched = Promise.withResolvers<readonly JobWithMetadata<unknown>[]>();
	const returned = Promise.withResolvers<{ readonly error: unknown; readonly at: number }>();
	const results: Array<{ readonly error: unknown; readonly at: number }> = [];
	const reads: number[] = [];
	let snapshot: readonly JobWithMetadata<unknown>[] = [];
	const findJobs: NonNullable<PgBossClient["findJobs"]> = (name, query) => {
		reads.push(Effect.runSync(Clock.currentTimeMillis));
		if (options.readout === "stalled") {
			return new Promise(() => undefined);
		}
		if (options.readout === "stale") {
			return Promise.resolve(snapshot.filter((job) => query?.id === undefined || job.id === query.id));
		}
		return client.findJobs(name, query);
	};
	const work: PgBossClient["work"] = (name, config, handler) =>
		client.work(name, config, async (jobs) => {
			snapshot = await client.findJobs(name);
			fetched.resolve(snapshot);
			const priorities = new Map(snapshot.map((job) => [job.id, job.priority]));
			const ordered = [...jobs].sort((left, right) => (priorities.get(right.id) ?? 0) - (priorities.get(left.id) ?? 0));
			const first = snapshot.find((job) => job.id === ordered[0]?.id);
			if (first?.startedOn === null || first?.startedOn === undefined) {
				throw new Error("The fetched claim must have its PostgreSQL start time");
			}
			if (options.waitForFirstExpiry) {
				const now = Effect.runSync(Clock.currentTimeMillis);
				await Effect.runPromise(Effect.sleep(Math.max(0, first.startedOn.getTime() + first.expireInSeconds * 1000 + 10 - now)));
			}
			let error: unknown;
			try {
				await handler(ordered.map((job) => ({ ...job, signal: AbortSignal.any([job.signal, abort.signal]) })));
			} catch (original) {
				error = original;
				throw original;
			} finally {
				const result = { at: Effect.runSync(Clock.currentTimeMillis), error };
				results.push(result);
				returned.resolve(result);
			}
		});
	const wrapped: PgBossClient = new Proxy(client, {
		get(target, property) {
			if (property === "findJobs") {
				return findJobs;
			}
			if (property === "work") {
				return work;
			}
			const value: unknown = Reflect.get(target, property);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
	return {
		abort: Effect.sync(() => abort.abort()),
		client: wrapped,
		fetched: Effect.promise(() => fetched.promise),
		reads,
		results,
		returned: Effect.promise(() => returned.promise),
	};
}
