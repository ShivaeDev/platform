import { Effect, Layer, Option } from "effect";
import { FetchHttpClient } from "effect/http";
import type { ChildProcessSpawner } from "effect/process";
import { Backend } from "@shivaedev/agent/backend.ts";
import type { ReadFailure } from "@shivaedev/agent/failures.ts";
import { providerAddress } from "#adapters/providerAddress.ts";
import { opencodeFailure } from "#failure.ts";
import { listOpencodeModels } from "#listOpencodeModels.ts";
import { makeOpencodeServer } from "#makeOpencodeServer.ts";
import { makeOperations } from "#operations.ts";
import type { OpencodeOptions } from "#options.ts";
import { Provider } from "#Provider.ts";
import { makeToolSessions } from "#toolSessions.ts";
export function opencode(
	options: OpencodeOptions & {
		readonly url: string;
	},
): Layer.Layer<Backend, ReadFailure>;
export function opencode(options: OpencodeOptions): Layer.Layer<Backend, ReadFailure, ChildProcessSpawner.ChildProcessSpawner>;
export function opencode(options: OpencodeOptions) {
	return Layer.effect(
		Backend,
		Effect.gen(function* () {
			const tools = makeToolSessions((options.tools ?? []).map((tool) => tool.name));
			let url = options.url;
			if (url !== undefined && (options.tools?.length || options.sessionTools !== undefined)) {
				return yield* Effect.fail(opencodeFailure("session tool bridging requires a spawned OpenCode server"));
			}
			if (url === undefined) {
				url = yield* providerAddress(options, tools);
			}
			const server = yield* makeOpencodeServer(url, tools);
			const operations = yield* makeOperations(options).pipe(Effect.provideService(Provider, server));
			return {
				backend: "opencode",
				events: operations.events,
				features: {
					imageInput: { reason: "only text input is implemented", support: "unsupported" },
					interruption: {
						implementation: { interrupt: (receipt) => operations.lookup(receipt).pipe(Effect.flatMap((run) => run.session.interrupt)) },
						support: "supported",
					},
					models: { implementation: { list: listOpencodeModels().pipe(Effect.provideService(Provider, server)) }, support: "supported" },
					queuedInput: {
						implementation: { queue: (receipt, input) => operations.lookup(receipt).pipe(Effect.flatMap((run) => run.session.queue(input))) },
						support: "supported",
					},
					sessions: { implementation: { resume: operations.resume }, support: "supported" },
					steering: {
						implementation: { steer: (receipt, input) => operations.lookup(receipt).pipe(Effect.flatMap((run) => run.session.steer(input))) },
						support: "supported",
					},
					transcript: { reason: "no provider history reader is implemented", support: "unsupported" },
				},
				inspect: operations.inspect,
				reconcile: operations.reconcile,
				start: (request) => operations.open(request, Option.none()),
			};
		}),
	).pipe(Layer.provide(FetchHttpClient.layer));
}
