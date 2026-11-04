import { Effect, Layer } from "effect";
import { Backend, type ConfiguredBackend } from "@shivaedev/agent/backend.ts";
import { listPiModels } from "#adapters/listPiModels.ts";
import { textOf } from "#adapters/textOf.ts";
import { makeOperations } from "#makeOperations.ts";
import type { PiOptions } from "#PiOptions.ts";

export function pi(options: PiOptions = {}): Layer.Layer<Backend> {
	return Layer.effect(
		Backend,
		Effect.gen(function* (): Effect.fn.Return<ConfiguredBackend> {
			const operations = yield* makeOperations(options);
			return {
				backend: "pi",
				events: operations.events,
				features: {
					imageInput: { reason: "only text input is implemented", support: "unsupported" },
					interruption: {
						implementation: { interrupt: (receipt) => operations.lookup(receipt).pipe(Effect.flatMap((run) => run.interrupt)) },
						support: "supported",
					},
					models: { implementation: { list: listPiModels }, support: "supported" },
					queuedInput: {
						implementation: {
							queue: (receipt, input) => operations.lookup(receipt).pipe(Effect.flatMap((run) => run.prompt(textOf(input), "followUp"))),
						},
						support: "supported",
					},
					sessions: { implementation: { resume: operations.resume }, support: "supported" },
					steering: {
						implementation: {
							steer: (receipt, input) => operations.lookup(receipt).pipe(Effect.flatMap((run) => run.prompt(textOf(input), "steer"))),
						},
						support: "supported",
					},
					transcript: { reason: "no provider history reader is implemented", support: "unsupported" },
				},
				inspect: operations.inspect,
				reconcile: operations.reconcile,
				start: (request) => operations.open(request, undefined),
			};
		}),
	);
}
