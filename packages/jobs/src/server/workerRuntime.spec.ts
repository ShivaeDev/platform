import { expect } from "vitest";
import { boss } from "#test/boss.ts";

boss.it(
	"runs handler sleeps on the worker runtime Clock",
	[],
	function* ({ workerRuntime }) {
		const worker = yield* workerRuntime.start();

		yield* workerRuntime.advance(99);
		expect(workerRuntime.events).toEqual([]);
		yield* workerRuntime.advance(1);
		yield* worker.finish;

		expect(workerRuntime.events).toEqual(["completed"]);
	},
	{ clock: "test" },
);

boss.it(
	"interrupts active handlers when their runtime scope closes",
	[],
	function* ({ workerRuntime, client }) {
		const worker = yield* workerRuntime.start();

		yield* worker.stop;
		yield* worker.finish;

		expect(workerRuntime.events).toEqual(["interrupted"]);
		expect(client.completeCalls).toEqual([]);
	},
	{ clock: "test" },
);
