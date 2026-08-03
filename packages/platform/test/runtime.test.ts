import { Context, Effect, Layer } from "effect";
import { afterAll, describe, expect, it } from "vitest";
import { makePlatformRuntime } from "../src/runtime.js";

class RuntimeValue extends Context.Service<RuntimeValue, string>()(
	"@test/PlatformRuntimeValue",
) {}

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
});
