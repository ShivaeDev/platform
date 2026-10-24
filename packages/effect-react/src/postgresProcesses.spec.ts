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
