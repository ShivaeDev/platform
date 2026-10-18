import { Effect, Layer, Schema, Stream } from "effect";
import { notFound } from "#server/errors.ts";
import { extendRequestServices, makeRequestServices } from "#server/requestServices.ts";
import { adapterHost } from "./adapterHost.ts";
import { AuthenticatedActor, DomainFailure, ExtendedRequestValue, RequestValue, RuntimeOnlyValue, RuntimeValue } from "./adapterServices.ts";
import { adapterSubscriptions } from "./adapterSubscriptions.ts";
import type { RouterEngine } from "./routerEngine.ts";
import { selectMode, selectRouter } from "./routerSetup.ts";
import { trpc } from "./routerStory.ts";

function* build(engine: RouterEngine) {
	const layer = Layer.mergeAll(Layer.succeed(RuntimeValue, "runtime"), Layer.succeed(RuntimeOnlyValue, "runtime-only"));
	const { adapter, t } = yield* adapterHost(engine, layer);
	const services = makeRequestServices((context: { readonly requestId: string }) => Layer.succeed(RequestValue, context.requestId));
	const procedure = adapter.procedure(t.procedure, services);
	const authenticated = t.procedure.use(({ ctx, next }) => next({ ctx: { ...ctx, actor: `actor:${ctx.requestId}` } }));
	const extended = extendRequestServices(services, () =>
		Layer.effect(
			ExtendedRequestValue,
			Effect.map(RequestValue, (id) => `extended:${id}`),
		),
	);
	const brokenLayer = makeRequestServices((): Layer.Layer<RequestValue> => {
		throw new Error("private layer detail");
	});
	const router = t.router({
		...adapterSubscriptions(engine, adapter, t),
		authenticated: adapter
			.procedure(
				authenticated,
				makeRequestServices((context: { readonly actor: string }) => Layer.succeed(AuthenticatedActor, context.actor)),
			)
			.query(function* () {
				return yield* AuthenticatedActor;
			}),
		cancelled: procedure.query(function* () {
			return yield* Effect.never;
		}),
		decodedInput: procedure.input(Schema.Struct({ value: Schema.NumberFromString })).query(function* (input) {
			yield* Effect.void;
			return input.value + 1;
		}),
		domainFailure: procedure.query(function* () {
			return yield* new DomainFailure({ message: "domain conflict" });
		}),
		events: adapter.procedure(t.procedure, brokenLayer).subscription(function* () {
			return yield* Effect.succeed(Stream.empty);
		}),
		explicitFailure: procedure.query(function* () {
			return yield* notFound("missing");
		}),
		extendedServices: adapter.procedure(t.procedure, extended).query(function* () {
			return { base: yield* RequestValue, extended: yield* ExtendedRequestValue };
		}),
		layerDefect: adapter.procedure(t.procedure, brokenLayer).query(function* () {
			return yield* Effect.succeed("unreachable");
		}),
		layerFailure: adapter
			.procedure(
				t.procedure,
				makeRequestServices(() => Layer.effect(RequestValue, Effect.fail(new DomainFailure({ message: "layer conflict" })))),
			)
			.query(function* () {
				return yield* Effect.succeed("unreachable");
			}),
		mutation: procedure.input(Schema.String).mutation(function* (input) {
			return yield* Effect.succeed(input.toUpperCase());
		}),
		services: procedure.query(function* () {
			return { requestValue: yield* RequestValue, runtimeOnlyValue: yield* RuntimeOnlyValue, runtimeValue: yield* RuntimeValue };
		}),
		transformedOutput: procedure.output(Schema.NumberFromString).query(function* () {
			return yield* Effect.succeed("42");
		}),
		unknownDefect: procedure.query(function* () {
			return yield* Effect.die(new Error("private detail"));
		}),
	});
	return { router, runWithServices: adapter.runWithServices, starts: new Map([["interruptible", engine.streamStarted.promise]]) };
}

export function adapterServices() {
	return trpc.trait("router", "runtime, request services and subscriptions are available", (engine) => {
		selectRouter(engine, "adapterServices", (state) => Effect.gen(() => build(state)));
	});
}

export function consumerInstrumentationThrows() {
	return trpc.trait("router", "consumer instrumentation throws", (engine) => {
		selectMode(engine, "consumerInstrumentationThrows", "instrument-defect");
	});
}
export function consumerMapperThrows() {
	return trpc.trait("router", "the consumer error mapper throws", (engine) => {
		selectMode(engine, "consumerMapperThrows", "mapper-defect");
	});
}
export function runtimeAcquisitionFails() {
	return trpc.trait("router", "the application runtime cannot acquire its dependency", (engine) => {
		selectMode(engine, "runtimeAcquisitionFails", "runtime-failure");
	});
}
