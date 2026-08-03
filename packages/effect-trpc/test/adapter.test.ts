import { initTRPC, TRPCError } from "@trpc/server";
import {
	Context,
	Data,
	Effect,
	Layer,
	ManagedRuntime,
	Option,
	Schema,
	Stream,
} from "effect";
import { afterAll, describe, expect, it } from "vitest";
import {
	extendRequestServices,
	makeEffectTRPC,
	makeRequestServices,
	notFound,
	RequestSignal,
} from "../src/index.js";

class RuntimeValue extends Context.Service<RuntimeValue, string>()(
	"@test/RuntimeValue",
) {}

class RuntimeOnlyValue extends Context.Service<RuntimeOnlyValue, string>()(
	"@test/RuntimeOnlyValue",
) {}

class RequestValue extends Context.Service<RequestValue, string>()(
	"@test/RequestValue",
) {}

class ExtendedRequestValue extends Context.Service<
	ExtendedRequestValue,
	string
>()("@test/ExtendedRequestValue") {}

class AuthenticatedActor extends Context.Service<AuthenticatedActor, string>()(
	"@test/AuthenticatedActor",
) {}

class DomainFailure extends Data.TaggedError("DomainFailure")<{
	readonly message: string;
}> {}

interface RequestContext {
	readonly requestId: string;
}

const runtime = ManagedRuntime.make(
	Layer.merge(
		Layer.succeed(RuntimeValue, "runtime"),
		Layer.succeed(RuntimeOnlyValue, "runtime-only"),
	),
);
const instrumented: Array<{ path: string; type: string }> = [];
const instrumentedStreams: Array<{ path: string; type: string }> = [];
const instrumentedRequestValues: Array<string> = [];
const finalizedStreams: string[] = [];
let markInterruptibleStarted: () => void = () => undefined;
const interruptibleStarted = new Promise<void>((resolve) => {
	markInterruptibleStarted = resolve;
});
const mapped: Array<{ origin: string; path: string }> = [];
const adapter = makeEffectTRPC({
	runtime,
	instrument: (effect, procedure) =>
		Effect.gen(function* () {
			instrumented.push({ path: procedure.path, type: procedure.type });
			const requestValue = yield* Effect.serviceOption(RequestValue);
			if (Option.isSome(requestValue)) {
				instrumentedRequestValues.push(requestValue.value);
			}
			return yield* effect;
		}),
	instrumentStream: (stream, procedure) => {
		instrumentedStreams.push({ path: procedure.path, type: procedure.type });
		return stream;
	},
	mapError: (error, context) => {
		mapped.push({ origin: context.origin, path: context.path });
		return error instanceof DomainFailure
			? new TRPCError({ code: "CONFLICT", message: error.message })
			: undefined;
	},
});
const t = initTRPC.context<RequestContext>().create();
const requestServices = makeRequestServices((context: RequestContext) =>
	Layer.succeed(RequestValue, context.requestId),
);
const extendedRequestServices = extendRequestServices(requestServices, () =>
	Layer.effect(
		ExtendedRequestValue,
		Effect.map(RequestValue, (requestId) => `extended:${requestId}`),
	),
);
const effectProcedure = adapter.procedure(t.procedure, requestServices);
const authenticatedProcedure = t.procedure.use(({ ctx, next }) =>
	next({ ctx: { ...ctx, actor: `actor:${ctx.requestId}` } }),
);
const authenticatedServices = makeRequestServices(
	(context: RequestContext & { readonly actor: string }) =>
		Layer.succeed(AuthenticatedActor, context.actor),
);
const router = t.router({
	authenticated: adapter
		.procedure(authenticatedProcedure, authenticatedServices)
		.query(function* () {
			return yield* AuthenticatedActor;
		}),
	decodedInput: effectProcedure
		.input(Schema.Struct({ value: Schema.NumberFromString }))
		.query(function* (input) {
			yield* Effect.void;
			return input.value + 1;
		}),
	domainFailure: effectProcedure.query(function* () {
		return yield* new DomainFailure({ message: "domain conflict" });
	}),
	explicitFailure: effectProcedure.query(function* () {
		return yield* notFound("missing");
	}),
	extendedServices: adapter
		.procedure(t.procedure, extendedRequestServices)
		.query(function* () {
			return {
				base: yield* RequestValue,
				extended: yield* ExtendedRequestValue,
			};
		}),
	layerFailure: adapter
		.procedure(
			t.procedure,
			makeRequestServices(() =>
				Layer.effect(
					RequestValue,
					Effect.fail(new DomainFailure({ message: "layer conflict" })),
				),
			),
		)
		.query(function* () {
			yield* Effect.void;
			return "unreachable";
		}),
	layerDefect: adapter
		.procedure(
			t.procedure,
			makeRequestServices((): Layer.Layer<RequestValue> => {
				throw new Error("private layer detail");
			}),
		)
		.query(function* () {
			yield* Effect.void;
			return "unreachable";
		}),
	mutation: effectProcedure.input(Schema.String).mutation(function* (input) {
		yield* Effect.void;
		return input.toUpperCase();
	}),
	interruptible: effectProcedure.subscription(function* () {
		return Stream.scoped(
			Stream.fromEffect(
				Effect.acquireRelease(Effect.sync(markInterruptibleStarted), () =>
					Effect.sync(() => finalizedStreams.push("interruptible")),
				),
			),
		).pipe(Stream.flatMap(() => Stream.never));
	}),
	services: effectProcedure.query(function* () {
		const runtimeValue = yield* RuntimeValue;
		const runtimeOnlyValue = yield* RuntimeOnlyValue;
		const requestValue = yield* RequestValue;
		return { requestValue, runtimeOnlyValue, runtimeValue };
	}),
	stream: effectProcedure.subscription(function* () {
		const requestValue = yield* RequestValue;
		const requestSignal = yield* RequestSignal;
		return Stream.scoped(
			Stream.fromEffect(
				Effect.acquireRelease(Effect.succeed(requestValue), (value) =>
					Effect.sync(() => finalizedStreams.push(value)),
				),
			),
		).pipe(
			Stream.flatMap((value) =>
				Stream.make(`${value}:one`, `${value}:two`, String(requestSignal)),
			),
		);
	}),
	transformedStream: effectProcedure
		.output(Schema.NumberFromString)
		.subscription(function* () {
			yield* Effect.void;
			return Stream.make("42", "43");
		}),
	transformedOutput: effectProcedure
		.output(Schema.NumberFromString)
		.query(function* () {
			yield* Effect.void;
			return "42";
		}),
	unknownDefect: effectProcedure.query(function* () {
		return yield* Effect.die(new Error("private detail"));
	}),
});

afterAll(() => runtime.dispose());

describe("makeEffectTRPC", () => {
	it("uses context added by tRPC middleware to build request services", async () => {
		const caller = router.createCaller({ requestId: "secured" });

		await expect(caller.authenticated()).resolves.toBe("actor:secured");
	});

	it("runs generator procedures with runtime and request services", async () => {
		const caller = router.createCaller({ requestId: "request-1" });

		await expect(caller.services()).resolves.toEqual({
			requestValue: "request-1",
			runtimeOnlyValue: "runtime-only",
			runtimeValue: "runtime",
		});
		expect(instrumented).toContainEqual({ path: "services", type: "query" });
		expect(instrumentedRequestValues).toContain("request-1");
	});

	it("preserves encoded and decoded Effect Schema types at runtime", async () => {
		const caller = router.createCaller({ requestId: "schema" });

		await expect(caller.decodedInput({ value: "4" })).resolves.toBe(5);
		await expect(caller.transformedOutput()).resolves.toBe(42);
	});

	it("builds mutation procedures", async () => {
		const caller = router.createCaller({ requestId: "mutation" });

		await expect(caller.mutation("changed")).resolves.toBe("CHANGED");
	});

	it("runs subscriptions as scoped Effect streams", async () => {
		const caller = router.createCaller({ requestId: "stream" });
		const values: string[] = [];

		for await (const value of await caller.stream(undefined))
			values.push(value);

		expect(values).toEqual(["stream:one", "stream:two", "undefined"]);
		expect(finalizedStreams).toContain("stream");
		expect(instrumentedStreams).toContainEqual({
			path: "stream",
			type: "subscription",
		});
	});

	it("preserves output schema transformations for subscription values", async () => {
		const caller = router.createCaller({ requestId: "stream-schema" });
		const values: number[] = [];

		for await (const value of await caller.transformedStream(undefined)) {
			values.push(value);
		}

		expect(values).toEqual([42, 43]);
	});

	it("interrupts subscriptions and runs finalizers on transport abort", async () => {
		const controller = new AbortController();
		const caller = router.createCaller(
			{ requestId: "interrupt" },
			{ signal: controller.signal },
		);
		const stream = await caller.interruptible(undefined);
		const iterator = stream[Symbol.asyncIterator]();
		const next = iterator.next();

		await interruptibleStarted;
		controller.abort();

		await expect(next).resolves.toEqual({ done: true, value: undefined });
		expect(finalizedStreams).toContain("interruptible");
	});

	it("passes explicit TRPCError failures through", async () => {
		const caller = router.createCaller({ requestId: "explicit" });

		await expect(caller.explicitFailure()).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "missing",
		});
	});

	it("extends request services using dependencies from the base Layer", async () => {
		const caller = router.createCaller({ requestId: "request-2" });

		await expect(caller.extendedServices()).resolves.toEqual({
			base: "request-2",
			extended: "extended:request-2",
		});
	});

	it("maps consumer failures from procedures and request Layers", async () => {
		const caller = router.createCaller({ requestId: "mapped" });

		await expect(caller.domainFailure()).rejects.toMatchObject({
			code: "CONFLICT",
			message: "domain conflict",
		});
		await expect(caller.layerFailure()).rejects.toMatchObject({
			code: "CONFLICT",
			message: "layer conflict",
		});
		expect(mapped).toContainEqual({ origin: "failure", path: "domainFailure" });
		expect(mapped).toContainEqual({ origin: "failure", path: "layerFailure" });
	});

	it("redacts unmapped defects", async () => {
		const caller = router.createCaller({ requestId: "defect" });

		await expect(caller.unknownDefect()).rejects.toMatchObject({
			code: "INTERNAL_SERVER_ERROR",
			message: "Internal server error",
		});
		expect(mapped).toContainEqual({ origin: "defect", path: "unknownDefect" });
	});

	it("redacts synchronous request Layer defects", async () => {
		const caller = router.createCaller({ requestId: "layer-defect" });

		await expect(caller.layerDefect()).rejects.toMatchObject({
			code: "INTERNAL_SERVER_ERROR",
			message: "Internal server error",
		});
		expect(mapped).toContainEqual({ origin: "defect", path: "layerDefect" });
	});

	it("merges ambient overrides on top of the application runtime", async () => {
		const caller = router.createCaller({ requestId: "ambient" });
		const overrides = Context.make(RuntimeValue, "override");

		const result = await adapter.runWithServices(overrides, () =>
			caller.services(),
		);

		expect(result).toEqual({
			requestValue: "ambient",
			runtimeOnlyValue: "runtime-only",
			runtimeValue: "override",
		});
	});
});
