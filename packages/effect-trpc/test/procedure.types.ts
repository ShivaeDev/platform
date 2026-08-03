import { initTRPC } from "@trpc/server";
import { Context, Effect, Layer, ManagedRuntime, Schema } from "effect";
import { expectTypeOf } from "vitest";
import { makeEffectTRPC, makeRequestServices } from "../src/index.js";

class RuntimeService extends Context.Service<RuntimeService, number>()(
	"@types/RuntimeService",
) {}

class RequestService extends Context.Service<RequestService, string>()(
	"@types/RequestService",
) {}

class MissingService extends Context.Service<MissingService, boolean>()(
	"@types/MissingService",
) {}

interface BaseContext {
	readonly requestId: string;
}

const runtime = ManagedRuntime.make(Layer.succeed(RuntimeService, 1));
const adapter = makeEffectTRPC({ runtime });
const t = initTRPC.context<BaseContext>().create();
const requestServices = makeRequestServices((context: BaseContext) =>
	Layer.succeed(RequestService, context.requestId),
);
const procedure = adapter.procedure(t.procedure, requestServices);

const transformed = procedure
	.input(Schema.Struct({ value: Schema.NumberFromString }))
	.output(Schema.NumberFromString)
	.query(function* (input) {
		expectTypeOf(input).toEqualTypeOf<{ readonly value: number }>();
		const runtimeValue = yield* RuntimeService;
		const requestValue = yield* RequestService;
		return String(input.value + runtimeValue + requestValue.length);
	});

const router = t.router({ transformed });
const caller = router.createCaller({ requestId: "typed" });
const result = caller.transformed({ value: "2" });

expectTypeOf(result).toEqualTypeOf<Promise<number>>();
expectTypeOf(result).not.toBeAny();

// @ts-expect-error The runtime and request Layer do not provide this service.
procedure.query(function* () {
	yield* MissingService;
	return "unreachable";
});

// @ts-expect-error The output schema requires the resolver to return a number.
procedure.output(Schema.Number).query(function* () {
	yield* Effect.void;
	return "wrong";
});
