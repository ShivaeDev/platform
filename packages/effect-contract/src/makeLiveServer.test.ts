import { Effect, Fiber, Schema, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { expect, it } from "vitest";
import { collection } from "#keys.ts";
import { makeLiveServer } from "#makeLiveServer.ts";

it("committed keys wake matching streams, and resync wakes every stream", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const live = yield* makeLiveServer;
				const orders = collection("orders", Schema.Number);
				const first: unknown[] = [];
				const second: unknown[] = [];
				const a = yield* live.stream([orders.item(1)]).pipe(
					Stream.tap((hint) => Effect.sync(() => first.push(hint))),
					Stream.take(3),
					Stream.runDrain,
					Effect.forkScoped,
				);
				const b = yield* live.stream([orders.item(2)]).pipe(
					Stream.tap((hint) => Effect.sync(() => second.push(hint))),
					Stream.take(2),
					Stream.runDrain,
					Effect.forkScoped,
				);
				yield* Effect.yieldNow;
				yield* Reactivity.invalidate(["orders:1"]);
				yield* Effect.yieldNow;
				expect(first).toEqual([{ _tag: "Resync" }, { _tag: "Changed", keys: [orders.item(1)] }]);
				expect(second).toEqual([{ _tag: "Resync" }]);
				yield* live.resync;
				yield* Fiber.join(a);
				yield* Fiber.join(b);
				expect(first.at(-1)).toEqual({ _tag: "Resync" });
				expect(second.at(-1)).toEqual({ _tag: "Resync" });
			}),
		).pipe(Effect.provide(Reactivity.layer)),
	));

it("resync belongs to its helper when independent helpers share Reactivity", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const first = yield* makeLiveServer;
				const second = yield* makeLiveServer;
				const orders = collection("orders", Schema.Number);
				const a: unknown[] = [];
				const b: unknown[] = [];
				yield* first.stream([orders.item(1)]).pipe(
					Stream.runForEach((hint) => Effect.sync(() => a.push(hint))),
					Effect.forkScoped,
				);
				yield* second.stream([orders.item(2)]).pipe(
					Stream.runForEach((hint) => Effect.sync(() => b.push(hint))),
					Effect.forkScoped,
				);
				yield* Effect.yieldNow;
				yield* first.resync;
				yield* Effect.yieldNow;
				expect(a).toEqual([{ _tag: "Resync" }, { _tag: "Resync" }]);
				expect(b).toEqual([{ _tag: "Resync" }]);
				yield* second.resync;
				yield* Effect.yieldNow;
				expect(b).toEqual([{ _tag: "Resync" }, { _tag: "Resync" }]);
			}),
		).pipe(Effect.provide(Reactivity.layer)),
	));
