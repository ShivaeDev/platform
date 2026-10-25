import { Effect } from "effect";
import { Order } from "./contract.ts";
import { client, type ProcessEngine, process } from "./processEngine.ts";
import { until } from "./processHarness.ts";

export function processVerbs(engine: ProcessEngine, tell: (line: string) => void) {
	function counts() {
		return [client(engine, "a").hints.length, client(engine, "b").hints.length];
	}
	async function bothSee(previous: number[]) {
		await until(() => client(engine, "a").hints.length > (previous[0] ?? 0) && client(engine, "b").hints.length > (previous[1] ?? 0));
		return { a: await client(engine, "a").get(), b: await client(engine, "b").get(), hints: [...client(engine, "a").hints] };
	}
	return {
		hints: (name: string) => [...client(engine, name).hints],
		localResyncs: () =>
			Effect.promise(async () => {
				tell("wait for both local clients to resync and the listener to reconnect");
				await until(
					() =>
						client(engine, "a")
							.hints.slice(engine.beforeRollback[0])
							.filter((hint) => hint._tag === "Resync").length >= 2
						&& client(engine, "another")
							.hints.slice(engine.anotherBeforeLoss)
							.some((hint) => hint._tag === "Resync"),
				);
				return {
					a: client(engine, "a").hints.slice(engine.beforeRollback[0]),
					another: client(engine, "another").hints.slice(engine.anotherBeforeLoss),
				};
			}),
		loseListener: () =>
			Effect.gen(function* () {
				tell("the first server loses its PostgreSQL listener");
				const sql = engine.sql;
				const listeners = yield* sql<{
					readonly pid: number;
				}>`select pid from pg_stat_activity where application_name = ${engine.configuration.applicationName} and query like 'LISTEN%'`;
				const listener = listeners[0];
				if (listeners.length !== 1 || listener === undefined) {
					return yield* Effect.die(new Error(`Expected one listener to terminate, found ${listeners.length}`));
				}
				return yield* sql`select pg_terminate_backend(${listener.pid}) as terminated`;
			}),
		rejectWrite: () =>
			Effect.gen(function* () {
				tell("a server rejects a transaction before commit");
				engine.beforeRollback = counts();
				engine.anotherBeforeLoss = client(engine, "another").hints.length;
				const first = process(engine, "first");
				first.child.send({ _tag: "Reject" });
				yield* Effect.promise(() => first.wait("Rejected"));
				const result = yield* Effect.promise(() => client(engine, "a").save("rolled back"));
				yield* Effect.sleep("350 millis");
				return {
					after: counts(),
					before: engine.beforeRollback,
					order: yield* Effect.promise(() => client(engine, "b").get()),
					result,
				};
			}),
		saveAfterReconnect: () =>
			Effect.promise(async () => {
				tell("a new commit reaches the reconnected listener");
				const previous = client(engine, "a").hints.length;
				const result = await client(engine, "b").save("after reconnect");
				await until(() => client(engine, "a").hints.length > previous && client(engine, "a").hints.at(-1)?._tag === "Changed");
				return { order: await client(engine, "a").get(), result };
			}),
		saveFromServer: (writer: string, name: string) =>
			Effect.promise(async () => {
				tell(`${writer} commits ${name} and both servers deliver the change`);
				const previous = counts();
				const result = await client(engine, writer).save(name);
				return { result, ...(await bothSee(previous)) };
			}),
		saveFromWorker: () =>
			Effect.promise(async () => {
				tell("the pg-boss worker commits an order and both servers deliver it");
				const previous = counts();
				const worker = process(engine, "worker");
				worker.child.send({ _tag: "Enqueue", order: new Order({ id: 1, name: "worker", quantity: 500 }) });
				await worker.wait("Handled");
				return bothSee(previous);
			}),
	};
}
