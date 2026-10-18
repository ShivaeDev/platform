import { execFile } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Cause, Context, Effect, Exit, Layer } from "effect";
import { afterAll, describe, expect, it, onTestFinished } from "vitest";
import { makePlatformRuntime } from "#runtime/make.ts";
import { RuntimeOther, RuntimeValue, runtimeLayer } from "#test/runtimeLayer.ts";

const { layer, lifecycle } = runtimeLayer();
const runtime = makePlatformRuntime(layer);
afterAll(() => runtime.dispose());
describe("makePlatformRuntime", () => {
	it("builds the application layer once", async () => {
		await expect(runtime.runPromise(RuntimeValue)).resolves.toBe("base");
		await expect(runtime.runPromise(RuntimeValue)).resolves.toBe("base");
		expect(lifecycle).toEqual({ acquisitions: 1, releases: 0 });
		expect(await runtime.runPromiseExit(RuntimeValue)).toEqual(Exit.succeed("base"));
	});
	it("dispose releases the application layer exactly once", async () => {
		const application = runtimeLayer();
		const disposable = makePlatformRuntime(application.layer);
		onTestFinished(() => disposable.dispose());
		await disposable.runPromise(RuntimeValue);
		expect(application.lifecycle).toEqual({ acquisitions: 1, releases: 0 });
		await disposable.dispose();
		expect(application.lifecycle.releases).toBe(1);
		await disposable.dispose();
		expect(application.lifecycle.releases).toBe(1);
	});
	it("propagates ambient services across promise boundaries", async () => {
		const override = Context.make(RuntimeValue, "request");
		const value = await runtime.runWithServices(override, async () => {
			await Promise.resolve();
			return runtime.runPromise(RuntimeValue);
		});
		expect(value).toBe("request");
	});
	it("nested runWithServices replaces outer overrides for its callback and restores them afterwards", async () => {
		const values = Effect.all([RuntimeValue, RuntimeOther]);
		const outer = Context.make(RuntimeValue, "outer").pipe(Context.add(RuntimeOther, "outer-other"));
		await runtime.runWithServices(outer, async () => {
			expect(await runtime.runPromise(values)).toEqual(["outer", "outer-other"]);
			await runtime.runWithServices(Context.make(RuntimeValue, "inner"), async () => {
				await Promise.resolve();
				expect(await runtime.runPromise(values)).toEqual(["inner", "base-other"]);
			});
			expect(await runtime.runPromise(values)).toEqual(["outer", "outer-other"]);
		});
		expect(await runtime.runPromise(values)).toEqual(["base", "base-other"]);
	});
	it("shares development runtimes by an explicit cache key", () => {
		const key = Symbol("runtime-test");
		const first = makePlatformRuntime(layer, { developmentCacheKey: key });
		const second = makePlatformRuntime(layer, { developmentCacheKey: key });
		expect(first).toBe(second);
		return first.dispose();
	});
	it("rebuilds a fresh runtime for the same development cache key after disposal", async () => {
		const application = runtimeLayer();
		const options = { developmentCacheKey: Symbol("runtime-recreation") };
		const first = makePlatformRuntime(application.layer, options);
		onTestFinished(() => first.dispose());
		await first.runPromise(RuntimeValue);
		await first.dispose();
		const second = makePlatformRuntime(application.layer, options);
		onTestFinished(() => second.dispose());
		expect(second).not.toBe(first);
		expect(makePlatformRuntime(application.layer, options)).toBe(second);
		await first.dispose();
		expect(makePlatformRuntime(application.layer, options)).toBe(second);
		expect(await second.runPromise(RuntimeValue)).toBe("base");
		expect(application.lifecycle).toEqual({ acquisitions: 2, releases: 1 });
		await second.dispose();
		expect(application.lifecycle.releases).toBe(2);
	});
	it("rejects runPromise with the original typed failure", async () => {
		const failure = new Error("application database unavailable");
		await expect(runtime.runPromise(Effect.fail(failure))).rejects.toBe(failure);
		expect(await runtime.runPromiseExit(Effect.fail(failure))).toEqual(Exit.fail(failure));
	});
	it("surfaces a layer build error as a typed exit failure and the original promise rejection", async () => {
		const failure = { _tag: "BuildFailure", message: "application layer unavailable" };
		const failing = makePlatformRuntime(Layer.effect(RuntimeValue, Effect.fail(failure)));
		onTestFinished(() => failing.dispose());
		expect(await failing.runPromiseExit(RuntimeValue)).toEqual(Exit.fail(failure));
		await expect(failing.runPromise(RuntimeValue)).rejects.toBe(failure);
	});
	it.each(["runPromise", "runPromiseExit"] as const)("%s forwards signal cancellation and runs the effect's finalizer", async (run) => {
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
				? expect(runtime.runPromise(effect, options)).rejects.toEqual(Cause.squash(Cause.interrupt()))
				: runtime.runPromiseExit(effect, options).then((exit) => {
						expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
					});
		await started.promise;
		expect(finalized).toBe(0);
		controller.abort();
		await completed;
		expect(finalized).toBe(1);
	});
	it("contextEffect includes request services without retaining them for the next request", async () => {
		const value = await runtime.runWithServices(Context.make(RuntimeValue, "request-context"), async () => {
			await Promise.resolve();
			return runtime.runPromise(Effect.map(runtime.contextEffect, (context) => Context.get(context, RuntimeValue)));
		});
		expect(value).toBe("request-context");
		expect(await runtime.runPromise(Effect.map(runtime.contextEffect, (context) => Context.get(context, RuntimeValue)))).toBe("base");
	});
	it("does not reuse development cache entries in production", async () => {
		const { stdout } = await promisify(execFile)(
			process.execPath,
			["--conditions=source", fileURLToPath(import.meta.resolve("#test/runtimeProduction.ts"))],
			{ env: { "NODE_ENV": "production" } },
		);
		expect(stdout.trim()).toBe("distinct");
	});
});
