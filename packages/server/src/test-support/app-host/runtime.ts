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
		cancelRuntime: (run: "runPromise" | "runPromiseExit") =>
			response(`/runtime/cancellation?run=${run}`).pipe(Effect.map((body) => JSON.parse(body))),
		developmentRuntimes: () => response("/runtime/development").pipe(Effect.map((body) => body === "true")),
		nestedRuntimeServices: () => response("/runtime/nested").pipe(Effect.map((body) => JSON.parse(body))),
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
		recreatedDevelopmentRuntime: () => response("/runtime/recreation").pipe(Effect.map((body) => JSON.parse(body))),
		runtimeExit: () => response("/runtime/exit").pipe(Effect.map((body) => JSON.parse(body))),
		runtimeFailure: () => response("/runtime/failure").pipe(Effect.map((body) => JSON.parse(body))),
		runtimeLayerFailure: () => response("/runtime/layer-failure").pipe(Effect.map((body) => JSON.parse(body))),
		runtimeValue: (override?: string, fromContext = false) => {
			const params = new URLSearchParams({ context: String(fromContext), ...(override === undefined ? {} : { override }) });
			return response(`/runtime/value?${params}`);
		},
	};
}
