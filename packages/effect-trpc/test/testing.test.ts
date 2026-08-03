import { expect } from "@effect/vitest";
import { initTRPC } from "@trpc/server";
import { Context, Effect, Layer, ManagedRuntime, Schema } from "effect";
import { afterAll } from "vitest";
import { makeEffectTRPC, makeRequestServices } from "../src/index.js";
import { makeTrpcHarnessIt, makeTrpcIt } from "../src/testing.js";

class RuntimeValue extends Context.Service<RuntimeValue, string>()(
	"@test/RuntimeValue",
) {}

class RuntimeOnlyValue extends Context.Service<RuntimeOnlyValue, string>()(
	"@test/RuntimeOnlyValue",
) {}

class RequestValue extends Context.Service<RequestValue, string>()(
	"@test/RequestValue",
) {}

interface CallerOptions {
	readonly requestId: string;
}

const runtime = ManagedRuntime.make(
	Layer.merge(
		Layer.succeed(RuntimeValue, "runtime"),
		Layer.succeed(RuntimeOnlyValue, "runtime-only"),
	),
);
const adapter = makeEffectTRPC({ runtime });
const t = initTRPC.context<CallerOptions>().create();
const requestServices = makeRequestServices((context: CallerOptions) =>
	Layer.succeed(RequestValue, context.requestId),
);
const procedure = adapter.procedure(t.procedure, requestServices);
const router = t.router({
	name: procedure.query(function* () {
		yield* Effect.void;
		return "procedure named name";
	}),
	read: procedure.input(Schema.String).query(function* (input) {
		return {
			input,
			request: yield* RequestValue,
			runtime: yield* RuntimeValue,
			runtimeOnly: yield* RuntimeOnlyValue,
		};
	}),
});

const it = makeTrpcIt({
	adapter,
	createCaller: (options = { requestId: "default" }) =>
		router.createCaller(options),
	layer: Layer.succeed(RuntimeValue, "test-override"),
	around: (effect) => Effect.withSpan(effect, "test.effect-trpc"),
});

const harnessIt = makeTrpcHarnessIt({
	adapter,
	createCaller: (options = { requestId: "default" }) =>
		router.createCaller(options),
	layer: Layer.succeed(RuntimeValue, "test-override"),
	makeHarness: (trpc, context) =>
		Effect.gen(function* () {
			return {
				contextName: context.task.name,
				runtime: yield* RuntimeValue,
				trpc,
			};
		}),
});

afterAll(() => runtime.dispose());

it.effectTRPC(
	"provides an Effect-shaped default caller and preserves runtime services",
	function* (trpc, context) {
		expect(context.task.name).toContain("Effect-shaped default caller");

		const result = yield* trpc.read("value");

		expect(result).toEqual({
			input: "value",
			request: "default",
			runtime: "test-override",
			runtimeOnly: "runtime-only",
		});
	},
);

it.effectTRPC(
	"creates callers with per-call options without rebuilding the test Layer",
	function* (trpc) {
		const first = yield* trpc({ requestId: "first" }).read("one");
		const second = yield* trpc({ requestId: "second" }).read("two");

		expect(first.request).toBe("first");
		expect(second.request).toBe("second");
	},
);

it.effectTRPC(
	"does not shadow procedures with JavaScript function properties",
	function* (trpc) {
		expect(yield* trpc.name()).toBe("procedure named name");
	},
);

it.effectTRPC.each(["first", "second"])(
	"supports table-driven Effect callers for %s",
	function* (requestId, trpc) {
		const result = yield* trpc({ requestId }).read("table");
		expect(result.request).toBe(requestId);
	},
);

harnessIt.effectTRPC(
	"builds an Effectful application harness inside the test Layer",
	function* (harness) {
		expect(harness.contextName).toContain("Effectful application harness");
		expect(harness.runtime).toBe("test-override");
		expect((yield* harness.trpc.read("harness")).input).toBe("harness");
	},
);
