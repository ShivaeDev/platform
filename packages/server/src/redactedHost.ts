import { Effect, Layer } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { RepositoryModels } from "@shivaedev/sql/RepositoryModels.ts";
import { redactingDiagnostics } from "#adapters/redactingDiagnostics.ts";
import { hostSensitiveKeys } from "#hostSensitiveKeys.ts";
import { otlpTracing } from "#otlpTracing.ts";
import { RedactionPolicy } from "#RedactionPolicy.ts";

export type HostSensitivePolicy = Effect.Success<ReturnType<typeof hostSensitiveKeys>>;

// Both hosts build their process inside one policy, so repositories declare their models to the same policy that masks every log, error report and exported span.
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
				Layer.provide(Layer.succeed(RepositoryModels, sensitive.models)),
			),
		),
	);
}
