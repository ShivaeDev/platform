import { Cause, Context, Effect, Equal, Exit, Layer } from "effect";
import { makePlatformRuntime } from "#runtime/makePlatform.ts";
import { RuntimeOther, RuntimeValue } from "./runtimeLayer.ts";
import { type HostState, runtimeOf } from "./state.ts";

async function failureResults(exit: () => Promise<Exit.Exit<unknown, unknown>>, promise: () => Promise<unknown>, failure: unknown) {
	const result = await exit();
	let rejection = "resolved";
	try {
		await promise();
	} catch (error) {
		rejection = error === failure ? "rejected with the original failure" : "rejected with another error";
	}
	return {
		runPromise: rejection,
		runPromiseExit: Equal.equals(result, Exit.fail(failure)) ? "failed with the original failure" : "ended with another exit",
	};
}

function interruptedFailure(error: unknown) {
	const interrupted = Cause.squash(Cause.interrupt());
	return (
		interrupted instanceof Error && error instanceof Error && error.constructor === interrupted.constructor && error.message === interrupted.message
	);
}

function promiseEnding(run: Promise<unknown>) {
	return run.then(
		() => "resolved",
		(error) => (interruptedFailure(error) ? "interrupted" : "rejected with another error"),
	);
}

function exitEnding(run: Promise<Exit.Exit<unknown, unknown>>) {
	return run.then((exit) => (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause) ? "interrupted" : "ended without interruption"));
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
				run === "runPromise" ? promiseEnding(runtime().runPromise(effect, options)) : exitEnding(runtime().runPromiseExit(effect, options));
			await started.promise;
			const before = finalized;
			controller.abort();
			const ending = await completed;
			return {
				ending,
				finalizer: before === 0 && finalized === 1 ? "ran once after the abort" : `ran ${finalized} times, ${before} before the abort`,
			};
		},
		exit: async () => {
			const exit = await runtime().runPromiseExit(value);
			return Exit.isSuccess(exit) ? `succeeded with ${exit.value}` : "failed";
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
