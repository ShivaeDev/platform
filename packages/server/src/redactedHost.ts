import { Effect, Layer } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { redactingDiagnostics } from "#adapters/redactingDiagnostics.ts";
import { hostSensitiveKeys } from "#hostSensitiveKeys.ts";
import { otlpTracing } from "#otlpTracing.ts";
import { RedactionPolicy } from "#RedactionPolicy.ts";

export type HostSensitivePolicy = Effect.Success<ReturnType<typeof hostSensitiveKeys>>;

// Both hosts build their process inside one policy, so every log, error report and exported span masks the same names, including the fields their repositories' models declare.
export function redactedHost<TRpcs extends Rpc.Any, A, E, R>(
	options: { readonly group?: RpcGroup.RpcGroup<TRpcs>; readonly config?: { readonly sensitiveKeys?: readonly string[] } },
	host: (sensitive: HostSensitivePolicy) => Layer.Layer<A, E, R>,
) {
	return Layer.unwrap(
		Effect.map(hostSensitiveKeys(options), (sensitive) =>
			host(sensitive).pipe(
				Layer.provide(redactingDiagnostics(sensitive)),
				Layer.provide(otlpTracing),
				Layer.provide(Layer.succeed(RedactionPolicy, sensitive)),
			),
		),
	);
}
