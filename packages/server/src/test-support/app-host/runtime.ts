import { execFile } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Context, Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { requests } from "./requests.ts";
import { RuntimeValue } from "./runtimeLayer.ts";
import { type HostState, io, runtimeOf } from "./state.ts";

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
export function runtimeVerbs(state: HostState, tell: (line: string) => void) {
	function response(path: string) {
		return requests(state, tell)
			.request(path)
			.pipe(
				Effect.flatMap((result) =>
					result.status === HttpStatus.fromLiteral("OK")
						? Effect.succeed(result.body)
						: Effect.fail(new Error(`Runtime route returned ${result.status}: ${result.body}`)),
				),
			);
	}
	return {
		abortedRun: (run: "runPromise" | "runPromiseExit") => {
			tell(`a ${run} call is aborted while its effect waits forever`);
			return response(`/runtime/cancellation?run=${run}`).pipe(Effect.map((body) => JSON.parse(body)));
		},
		developmentRuntimes: () => {
			tell("two development runtimes are made with one cache key and both answer native RPC");
			return response("/runtime/development");
		},
		nestedRuntimeServices: () => {
			tell("runWithServices nests an inner override inside an outer one");
			return response("/runtime/nested").pipe(Effect.map((body) => JSON.parse(body)));
		},
		productionRuntimes: () => {
			tell("two production runtimes are made with one cache key under NODE_ENV=production and both answer native RPC");
			return io(async () => {
				const { stdout } = await promisify(execFile)(
					process.execPath,
					["--conditions=source", fileURLToPath(import.meta.resolve("#test/runtimeProduction.ts"))],
					{ env: { "NODE_ENV": "production" } },
				);
				return stdout.trim();
			});
		},
		recreatedDevelopmentRuntime: () => {
			tell("a cached development runtime is disposed and its key is used again");
			return response("/runtime/recreation").pipe(Effect.map((body) => JSON.parse(body)));
		},
		runtimeExit: () => {
			tell("runPromiseExit reads the application layer's value");
			return response("/runtime/exit").pipe(Effect.map((body) => JSON.parse(body)));
		},
		runtimeFailure: () => {
			tell("runPromise and runPromiseExit run an effect that fails with a typed error");
			return response("/runtime/failure").pipe(Effect.map((body) => JSON.parse(body)));
		},
		runtimeLayerFailure: () => {
			tell("a runtime whose application layer fails to build is run");
			return response("/runtime/layer-failure").pipe(Effect.map((body) => JSON.parse(body)));
		},
		runtimeValue: (override?: string, fromContext = false) => {
			tell(
				`runPromise reads the application value${override === undefined ? "" : ` inside runWithServices(${override})`}${fromContext ? " through contextEffect" : ""}`,
			);
			const params = new URLSearchParams({ context: String(fromContext), ...(override === undefined ? {} : { override }) });
			return response(`/runtime/value?${params}`);
		},
	};
}
