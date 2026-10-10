import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Context, Effect, Layer } from "effect";
import { afterAll, describe, expect, it } from "vitest";
import { makePlatformRuntime } from "#runtime/make.ts";

class RuntimeValue extends Context.Service<RuntimeValue, string>()("@test/PlatformRuntimeValue") {}

let acquisitions = 0;
let releases = 0;
const layer = Layer.effect(
	RuntimeValue,
	Effect.acquireRelease(
		Effect.sync(() => {
			acquisitions += 1;
			return "base";
		}),
		() =>
			Effect.sync(() => {
				releases += 1;
			}),
	),
);
const runtime = makePlatformRuntime(layer);

afterAll(() => runtime.dispose());

describe("makePlatformRuntime", () => {
	it("builds the application layer once", async () => {
		await expect(runtime.runPromise(RuntimeValue)).resolves.toBe("base");
		await expect(runtime.runPromise(RuntimeValue)).resolves.toBe("base");
		expect(acquisitions).toBe(1);
		expect(releases).toBe(0);
	});

	it("propagates ambient services across promise boundaries", async () => {
		const override = Context.make(RuntimeValue, "request");
		const value = await runtime.runWithServices(override, async () => {
			await Promise.resolve();
			return runtime.runPromise(RuntimeValue);
		});

		expect(value).toBe("request");
	});

	it("shares development runtimes by an explicit cache key", () => {
		const key = Symbol("runtime-test");
		const first = makePlatformRuntime(layer, { developmentCacheKey: key });
		const second = makePlatformRuntime(layer, { developmentCacheKey: key });
		expect(first).toBe(second);
		return first.dispose();
	});

	it("rejects runPromise with the original typed failure", async () => {
		const failure = new Error("application database unavailable");
		await expect(runtime.runPromise(Effect.fail(failure))).rejects.toBe(failure);
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
			["--conditions=source", fileURLToPath(new URL("../test-support/runtimeProduction.ts", import.meta.url))],
			{ env: { "NODE_ENV": "production" } },
		);
		expect(stdout.trim()).toBe("distinct");
	});
});
