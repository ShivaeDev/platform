import { expect } from "vitest";
import { processes, twoServersAndWorker } from "#test/postgres-example/processKit.ts";

processes.it(
	"commits from two HTTP servers and a pg-boss worker wake both servers; rollback stays silent and listener loss resyncs",
	[twoServersAndWorker()],
	function* ({ hints, saveFromServer, saveFromWorker, rejectWrite, loseListener, localResyncs, saveAfterReconnect }) {
		expect(hints("a")).toEqual([{ _tag: "Resync" }]);
		expect(hints("b")).toEqual([{ _tag: "Resync" }]);
		for (const [writer, name] of [
			["a", "server one"],
			["b", "server two"],
		] as const) {
			const saved = yield* saveFromServer(writer, name);
			expect(saved.result).toMatchObject({ _tag: "Success" });
			expect(saved.a.name).toBe(name);
			expect(saved.b.name).toBe(name);
			expect(saved.hints.at(-1)).toEqual({ _tag: "Changed", keys: [{ _tag: "Item", collection: "orders", id: 1 }] });
		}
		const handled = yield* saveFromWorker();
		expect(handled.a.name).toBe("worker");
		expect(handled.b.name).toBe("worker");
		const rejected = yield* rejectWrite();
		expect(rejected.result).toMatchObject({ _tag: "Failure", failure: { _tag: "Rejected" } });
		expect(rejected.after).toEqual(rejected.before);
		expect(rejected.order.name).toBe("worker");
		expect(yield* loseListener()).toEqual([{ terminated: true }]);
		const resyncs = yield* localResyncs();
		const disconnectedAndReconnected = 2;
		expect(resyncs.a.filter((hint) => hint._tag === "Resync")).toHaveLength(disconnectedAndReconnected);
		expect(resyncs.another).toContainEqual({ _tag: "Resync" });
		const reconnected = yield* saveAfterReconnect();
		expect(reconnected.result).toMatchObject({ _tag: "Success" });
		expect(reconnected.order.name).toBe("after reconnect");
	},
	30_000,
);

processes.it(
	"both servers and the worker recover together after every database backend is terminated",
	[twoServersAndWorker()],
	function* ({ hints, processLogs, terminateBackends, waitForRecovery, waitForResyncs, getFromServer, saveFromWorker, saveFromServer }) {
		for (const name of ["first", "second"]) {
			expect(
				processLogs(name).filter(
					(log) =>
						Array.isArray(log.message)
						&& log.message.some((message) => typeof message === "string" && message.startsWith("PostgreSQL change listener")),
				),
			).toEqual([]);
		}
		const terminated = yield* terminateBackends();
		expect(terminated.length).toBeGreaterThanOrEqual(5);
		expect(terminated).toEqual(terminated.map(() => ({ terminated: true })));
		expect(yield* getFromServer("a")).toMatchObject({ id: 1 });
		expect(yield* getFromServer("b")).toMatchObject({ id: 1 });
		yield* waitForRecovery();
		yield* waitForResyncs();
		for (const name of ["a", "b", "another"]) {
			expect(hints(name).slice(1)).toContainEqual({ _tag: "Resync" });
		}
		const handled = yield* saveFromWorker();
		expect(handled.a.name).toBe("worker");
		expect(handled.b.name).toBe("worker");
		const saved = yield* saveFromServer("a", "after failover");
		expect(saved.result).toMatchObject({ _tag: "Success" });
		expect(saved.b.name).toBe("after failover");
		for (const [name, streamCount] of [
			["first", 2],
			["second", 1],
		] as const) {
			const logs = processLogs(name).filter(
				(log) =>
					Array.isArray(log.message)
					&& log.message.some((message) => typeof message === "string" && message.startsWith("PostgreSQL change listener")),
			);
			expect(logs).toEqual([
				{ _tag: "Log", annotations: {}, level: "Warn", message: ["PostgreSQL change listener lost; resynchronizing live streams"] },
				{
					_tag: "Log",
					annotations: { downtimeMs: expect.any(Number), streamCount },
					level: "Info",
					message: ["PostgreSQL change listener recovered; resynchronized live streams"],
				},
			]);
		}
	},
	30_000,
);
