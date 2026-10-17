import { execFile } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Context, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { makePlatformRuntime } from "#runtime/make.ts";
import { ping } from "./ping.ts";
import { requests } from "./requests.ts";
import { type HostState, io, runtimeOf } from "./state.ts";

class RuntimeValue extends Context.Service<RuntimeValue, string>()("@test/PlatformRuntimeValue") {}
export function runtimeLayer(lifecycle: string[]) {
	return Layer.effect(
		RuntimeValue,
		Effect.acquireRelease(
			Effect.sync(() => {
				lifecycle.push("acquired");
				return "base";
			}),
			() =>
				Effect.sync(() => {
					lifecycle.push("disposed");
				}),
		),
	);
}
export function readRuntimeValue(state: HostState, override?: string, fromContext = false) {
	const runtime = runtimeOf(state);
	function value() {
		return runtime.runPromise(
			Effect.map(fromContext ? runtime.contextEffect : Effect.context(), (services) => Context.getUnsafe(services, RuntimeValue)),
		);
	}
	return override === undefined
		? value()
		: runtime.runWithServices(Context.make(RuntimeValue, override), async () => {
				await Promise.resolve();
				return value();
			});
}
export async function sharedDevelopmentRuntime(state: HostState) {
	const key = Symbol("runtime-test");
	const layer = state.build(state);
	const first = makePlatformRuntime(layer, { developmentCacheKey: key });
	const second = makePlatformRuntime(layer, { developmentCacheKey: key });
	try {
		for (const runtime of [first, second]) {
			const server = await runtime.runPromise(HttpServer.HttpServer);
			if ((await ping(`${HttpServer.formatAddress(server.address)}/rpc`)) !== "pong") {
				throw new Error("A cached host did not answer RPC");
			}
		}
		return first === second;
	} finally {
		await first.dispose();
		if (first !== second) {
			await second.dispose();
		}
	}
}
export function runtimeVerbs(state: HostState, tell: (line: string) => void) {
	function response(path: string) {
		return requests(state, tell)
			.request(path)
			.pipe(
				Effect.flatMap((result) =>
					result.status === 200 ? Effect.succeed(result.body) : Effect.fail(new Error(`Runtime route returned ${result.status}: ${result.body}`)),
				),
			);
	}
	return {
		developmentRuntimes: () => response("/runtime/development").pipe(Effect.map((body) => body === "true")),
		productionRuntimes: () => {
			tell("two production hosts answer native RPC");
			return io(async () => {
				const { stdout } = await promisify(execFile)(
					process.execPath,
					["--conditions=source", fileURLToPath(import.meta.resolve("#test/runtimeProduction.ts"))],
					{ env: { "NODE_ENV": "production" } },
				);
				return stdout.trim();
			});
		},
		runtimeFailure: () => response("/runtime/failure").pipe(Effect.map((body) => body === "true")),
		runtimeValue: (override?: string, fromContext = false) => {
			const params = new URLSearchParams({ context: String(fromContext), ...(override === undefined ? {} : { override }) });
			return response(`/runtime/value?${params}`);
		},
	};
}
