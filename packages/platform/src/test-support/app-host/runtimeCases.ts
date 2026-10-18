import { Cause, Context, Effect, Equal, Exit, Layer } from "effect";
import { makePlatformRuntime } from "#runtime/make.ts";
import { RuntimeOther, RuntimeValue } from "./runtimeLayer.ts";
import { type HostState, runtimeOf } from "./state.ts";

async function failureResults(exit: () => Promise<Exit.Exit<unknown, unknown>>, promise: () => Promise<unknown>, failure: unknown) {
	const result = await exit();
	let promiseOriginal = false;
	try {
		await promise();
	} catch (error) {
		promiseOriginal = error === failure;
	}
	return { exitOriginal: Equal.equals(result, Exit.fail(failure)), promiseOriginal };
}

function interruptedFailure(error: unknown) {
	const interrupted = Cause.squash(Cause.interrupt());
	return (
		interrupted instanceof Error && error instanceof Error && error.constructor === interrupted.constructor && error.message === interrupted.message
	);
}

export function runtimeCases(state: HostState) {
	function runtime() {
		return runtimeOf(state);
	}
	const value = Effect.map(Effect.context(), (services) => Context.getUnsafe(services, RuntimeValue));
	return {
		cancellation: async (run: string) => {
			const started = Promise.withResolvers<void>();
			const controller = new AbortController();
			let finalized = 0;
			const effect = Effect.acquireUseRelease(
				Effect.sync(() => started.resolve()),
				() => Effect.never,
				() =>
					Effect.sync(() => {
						finalized += 1;
					}),
			);
			const options = { signal: controller.signal };
			const completed =
				run === "runPromise"
					? runtime()
							.runPromise(effect, options)
							.then(() => false, interruptedFailure)
					: runtime()
							.runPromiseExit(effect, options)
							.then((exit) => Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause));
			await started.promise;
			const before = finalized;
			controller.abort();
			const canceled = await completed;
			return { before, finalized, interrupted: canceled };
		},
		exit: async () => {
			const exit = await runtime().runPromiseExit(value);
			return Exit.isSuccess(exit) ? { success: exit.value } : { failed: true };
		},
		failure: () => {
			const failure = new Error("application database unavailable");
			return failureResults(
				() => runtime().runPromiseExit(Effect.fail(failure)),
				() => runtime().runPromise(Effect.fail(failure)),
				failure,
			);
		},
		layerFailure: async () => {
			const failure = { _tag: "BuildFailure", message: "application layer unavailable" };
			const failing = makePlatformRuntime(Layer.effect(RuntimeValue, Effect.fail(failure)));
			try {
				return await failureResults(
					() => failing.runPromiseExit(RuntimeValue),
					() => failing.runPromise(RuntimeValue),
					failure,
				);
			} finally {
				await failing.dispose();
			}
		},
		nested: async () => {
			const values = Effect.map(Effect.context(), (services) => [
				Context.getUnsafe(services, RuntimeValue),
				Context.getUnsafe(services, RuntimeOther),
			]);
			const outer = Context.make(RuntimeValue, "outer").pipe(Context.add(RuntimeOther, "outer-other"));
			const observed = await runtime().runWithServices(outer, async () => {
				const before = await runtime().runPromise(values);
				const inner = await runtime().runWithServices(Context.make(RuntimeValue, "inner"), async () => {
					await Promise.resolve();
					return runtime().runPromise(values);
				});
				return { after: await runtime().runPromise(values), before, inner };
			});
			return { ...observed, base: await runtime().runPromise(values) };
		},
	};
}
