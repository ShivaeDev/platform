import { setTimeout } from "node:timers/promises";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Effect, ManagedRuntime, Option, Redacted, Result } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { expect, test } from "vitest";
import { Order } from "#test/postgres-example/contract.ts";
import { processClient } from "#test/postgres-example/processClient.ts";
import { startProcess, until } from "#test/postgres-example/processHarness.ts";

const databaseUrl = Effect.runSync(Config.string("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL").pipe(Config.option));
const integration = Option.isSome(databaseUrl) ? test : test.skip;

integration(
	"commits from two HTTP servers and a pg-boss worker wake both servers; rollback stays silent and listener loss resyncs",
	async () => {
		if (Option.isNone(databaseUrl)) {
			throw new Error("PostgreSQL URL required");
		}
		const suffix = crypto.randomUUID().replaceAll("-", "");
		const configuration = {
			applicationName: `order_server_${suffix}`,
			channel: `order_changes_${suffix}`,
			databaseUrl: databaseUrl.value,
			ledger: `order_migrations_${suffix}`,
			queue: `order-save-${suffix}`,
			role: "server" as const,
			schema: `order_jobs_${suffix}`,
			table: `order_rows_${suffix}`,
		};
		const observer = ManagedRuntime.make(PgClient.layer({ url: Redacted.make(databaseUrl.value) }));
		const processes: Array<Awaited<ReturnType<typeof startProcess>>> = [];
		const clients: Array<Awaited<ReturnType<typeof processClient>>> = [];
		try {
			const first = await startProcess(configuration);
			processes.push(first);
			const second = await startProcess({ ...configuration, applicationName: `${configuration.applicationName}_second` });
			processes.push(second);
			const worker = await startProcess({ ...configuration, role: "worker" });
			processes.push(worker);
			const a = await processClient(first.url);
			clients.push(a);
			const b = await processClient(second.url);
			clients.push(b);
			const another = await processClient(first.url);
			clients.push(another);
			await until(() => a.hints.length > 0 && b.hints.length > 0 && another.hints.length > 0);
			expect(a.hints).toEqual([{ _tag: "Resync" }]);
			expect(b.hints).toEqual([{ _tag: "Resync" }]);
			for (const [client, name] of [
				[a, "server one"],
				[b, "server two"],
			] as const) {
				const previous = [a.hints.length, b.hints.length];
				expect(Result.isSuccess(await client.save(name))).toBe(true);
				await until(() => a.hints.length > (previous[0] ?? 0) && b.hints.length > (previous[1] ?? 0));
				expect((await a.get()).name).toBe(name);
				expect((await b.get()).name).toBe(name);
				expect(a.hints.at(-1)).toEqual({ _tag: "Changed", keys: [{ _tag: "Item", collection: "orders", id: 1 }] });
			}
			const beforeWorker = [a.hints.length, b.hints.length];
			worker.child.send({ _tag: "Enqueue", order: new Order({ id: 1, name: "worker", quantity: 500 }) });
			await worker.wait("Handled");
			await until(() => a.hints.length > (beforeWorker[0] ?? 0) && b.hints.length > (beforeWorker[1] ?? 0));
			expect((await a.get()).name).toBe("worker");
			expect((await b.get()).name).toBe("worker");
			const beforeRollback = [a.hints.length, b.hints.length];
			const anotherBeforeLoss = another.hints.length;
			first.child.send({ _tag: "Reject" });
			await first.wait("Rejected");
			const rejected = await a.save("rolled back");
			expect(Result.isFailure(rejected) && rejected.failure._tag).toBe("Rejected");
			await setTimeout(350);
			expect([a.hints.length, b.hints.length]).toEqual(beforeRollback);
			expect((await b.get()).name).toBe("worker");
			const killed = await observer.runPromise(
				SqlClient.SqlClient.use(
					(sql) =>
						sql<{
							readonly pid: number;
						}>`select pid from pg_stat_activity where application_name = ${configuration.applicationName} and query like 'LISTEN%'`,
				),
			);
			expect(killed).toHaveLength(1);
			await observer.runPromise(SqlClient.SqlClient.use((sql) => sql`select pg_terminate_backend(${killed[0]?.pid})`));
			await until(
				() =>
					a.hints.slice(beforeRollback[0]).some((hint) => hint._tag === "Resync")
					&& another.hints.slice(anotherBeforeLoss).some((hint) => hint._tag === "Resync"),
			);
			await until(() => a.hints.slice(beforeRollback[0]).filter((hint) => hint._tag === "Resync").length >= 2);
			const beforeRecovery = a.hints.length;
			expect(Result.isSuccess(await b.save("after reconnect"))).toBe(true);
			await until(() => a.hints.length > beforeRecovery && a.hints.at(-1)?._tag === "Changed");
			expect((await a.get()).name).toBe("after reconnect");
		} finally {
			for (const client of clients.reverse()) {
				await client.close();
			}
			for (const child of processes.reverse()) {
				await child.close();
			}
			try {
				await observer.runPromise(
					SqlClient.SqlClient.use((sql) =>
						Effect.all([
							sql`drop table if exists ${sql(configuration.table)}, ${sql(configuration.ledger)}`,
							sql`drop schema if exists ${sql(configuration.schema)} cascade`,
						]),
					),
				);
			} finally {
				await observer.dispose();
			}
		}
	},
	30_000,
);
