import { Effect, Result } from "effect";
import { expect } from "vitest";
import { Order } from "./contract.ts";
import { client, type ProcessEngine, process } from "./processEngine.ts";
import { until } from "./processHarness.ts";

export function processVerbs(engine: ProcessEngine, tell: (line: string) => void) {
	function a() {
		return client(engine, "a");
	}
	function b() {
		return client(engine, "b");
	}
	function counts() {
		return [a().hints.length, b().hints.length];
	}
	function bothSee(name: string, previous: number[]) {
		return Effect.promise(async () => {
			await until(() => a().hints.length > (previous[0] ?? 0) && b().hints.length > (previous[1] ?? 0));
			expect((await a().get()).name).toBe(name);
			expect((await b().get()).name).toBe(name);
		});
	}
	return {
		allLocalClientsResync: () =>
			Effect.promise(async () => {
				tell("both clients on the affected server resync, including after reconnect");
				await until(
					() =>
						a()
							.hints.slice(engine.beforeRollback[0])
							.some((hint) => hint._tag === "Resync")
						&& client(engine, "another")
							.hints.slice(engine.anotherBeforeLoss)
							.some((hint) => hint._tag === "Resync"),
				);
				await until(
					() =>
						a()
							.hints.slice(engine.beforeRollback[0])
							.filter((hint) => hint._tag === "Resync").length >= 2,
				);
			}),
		clientsStartWithResync: () =>
			Effect.sync(() => {
				tell("both servers send their initial resync");
				expect(a().hints).toEqual([{ _tag: "Resync" }]);
				expect(b().hints).toEqual([{ _tag: "Resync" }]);
			}),
		loseListener: () =>
			Effect.gen(function* () {
				tell("the first server loses its PostgreSQL listener");
				const sql = engine.sql;
				const killed = yield* sql<{
					readonly pid: number;
				}>`select pid from pg_stat_activity where application_name = ${engine.configuration.applicationName} and query like 'LISTEN%'`;
				expect(killed).toHaveLength(1);
				yield* sql`select pg_terminate_backend(${killed[0]?.pid})`;
			}),
		rejectedWriteStaysSilent: () =>
			Effect.gen(function* () {
				tell("a rejected transaction leaves storage and live subscribers unchanged");
				engine.beforeRollback = counts();
				engine.anotherBeforeLoss = client(engine, "another").hints.length;
				const first = process(engine, "first");
				first.child.send({ _tag: "Reject" });
				yield* Effect.promise(() => first.wait("Rejected"));
				const rejected = yield* Effect.promise(() => a().save("rolled back"));
				expect(Result.isFailure(rejected) && rejected.failure._tag).toBe("Rejected");
				yield* Effect.sleep("350 millis");
				expect(counts()).toEqual(engine.beforeRollback);
				expect((yield* Effect.promise(() => b().get())).name).toBe("worker");
			}),
		saveAfterReconnect: () =>
			Effect.promise(async () => {
				tell("a new commit reaches the reconnected listener");
				const previous = a().hints.length;
				expect(Result.isSuccess(await b().save("after reconnect"))).toBe(true);
				await until(() => a().hints.length > previous && a().hints.at(-1)?._tag === "Changed");
				expect((await a().get()).name).toBe("after reconnect");
			}),
		saveFromServer: (writer: string, name: string) =>
			Effect.gen(function* () {
				tell(`${writer} commits ${name} and both servers deliver the change`);
				const previous = counts();
				expect(Result.isSuccess(yield* Effect.promise(() => client(engine, writer).save(name)))).toBe(true);
				yield* bothSee(name, previous);
				expect(a().hints.at(-1)).toEqual({ _tag: "Changed", keys: [{ _tag: "Item", collection: "orders", id: 1 }] });
			}),
		saveFromWorker: () =>
			Effect.gen(function* () {
				tell("the pg-boss worker commits an order and both servers deliver it");
				const previous = counts();
				const worker = process(engine, "worker");
				worker.child.send({ _tag: "Enqueue", order: new Order({ id: 1, name: "worker", quantity: 500 }) });
				yield* Effect.promise(() => worker.wait("Handled"));
				yield* bothSee("worker", previous);
			}),
	};
}
