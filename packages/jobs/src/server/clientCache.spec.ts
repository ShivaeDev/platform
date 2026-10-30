import { Effect, Schema } from "effect";
import type { ConstructorOptions } from "pg-boss";
import { expect, vi } from "vitest";
import { defineQueue } from "#definition.ts";
import { PgBossClientOptionsError } from "#error.ts";
import { boss } from "#test/boss.ts";

boss.it("shares equal settings and rejects a conflicting build without losing client ownership", [], function* ({ boot, client }) {
	const factory = vi.fn(() => client);
	const Queue = defineQueue({ name: "cached", schema: Schema.Struct({}) });
	const worker = Queue.handle(() => Effect.void);
	const options = { clientCacheKey: Symbol("cached"), clientFactory: factory, connectionString: "postgresql://shared", schema: "shared" };
	const first = yield* boot([worker], { ...options, ssl: { rejectUnauthorized: true } });
	const second = yield* boot([worker], { ...options, ssl: { rejectUnauthorized: true } });
	const error = yield* Effect.flip(boot([worker], { ...options, schema: "different", ssl: { rejectUnauthorized: true } }));
	expect(error).toMatchObject({ _tag: "PgBossClientOptionsError", key: options.clientCacheKey, options: ["schema"] });
	expect(client).toMatchObject({ startCalls: 1, stopCalls: 0 });
	yield* first.stop;
	expect(client).toMatchObject({ stopCalls: 0 });
	yield* second.stop;
	expect(factory).toHaveBeenCalledTimes(1);
	expect(client).toMatchObject({ offWorkCalls: ["cached", "cached", "cached"], startCalls: 1, stopCalls: 1 });
});

const conflicts: readonly { name: string; first: ConstructorOptions; second: ConstructorOptions; options: readonly string[] }[] = [
	{
		first: { connectionString: "postgresql://first" },
		name: "a connection string changes",
		options: ["connectionString"],
		second: { connectionString: "postgresql://second" },
	},
	{ first: { schema: "first" }, name: "a schema changes", options: ["schema"], second: { schema: "second" } },
	{ first: { max: 2 }, name: "the pool size changes", options: ["max"], second: { max: 3 } },
	{ first: {}, name: "an option is added", options: ["schedule"], second: { schedule: false } },
	{ first: { schedule: false }, name: "an option is removed", options: ["schedule"], second: {} },
	{ first: { ssl: { rejectUnauthorized: true } }, name: "nested settings change", options: ["ssl"], second: { ssl: { rejectUnauthorized: false } } },
	{ first: { max: 2, schema: "first" }, name: "several settings change", options: ["max", "schema"], second: { max: 3, schema: "second" } },
];

for (const conflict of conflicts) {
	boss.it(`rejects a shared client key before constructing a client when ${conflict.name}`, [], function* ({ boot, client }) {
		const factory = vi.fn(() => client);
		const key = `shared-${conflict.name}`;
		const options = { clientCacheKey: key, clientFactory: factory };
		const first = yield* boot([], { ...options, ...conflict.first });
		const error = yield* Effect.flip(boot([], { ...options, ...conflict.second }));
		expect(error).toBeInstanceOf(PgBossClientOptionsError);
		expect(error).toMatchObject({ key, options: conflict.options });
		expect(error.message).toBe(`Shared pg-boss client ${key} has different constructor settings: ${conflict.options.join(", ")}`);
		expect(factory).toHaveBeenCalledTimes(1);
		expect(client).toMatchObject({ startCalls: 1, stopCalls: 0 });
		yield* first.stop;
		expect(client).toMatchObject({ stopCalls: 1 });
	});
}
