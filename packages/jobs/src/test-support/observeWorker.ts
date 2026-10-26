import type { Job, PgBoss } from "pg-boss";
import type { PgBossClient } from "#client.ts";

export function observeWorker(client: PgBoss, observe: (jobs: readonly Job<unknown>[]) => readonly Job<unknown>[]): PgBossClient {
	const work: PgBossClient["work"] = (name, options, handler) => client.work(name, options, (jobs) => handler(observe(jobs)));
	return new Proxy(client, {
		get(target, property) {
			if (property === "work") {
				return work;
			}
			const value = Reflect.get(target, property);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
}
