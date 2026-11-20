import { Effect, Layer, Schema } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { collectRepositoryModels, RepositoryModels } from "@shivaedev/sql/RepositoryModels.ts";
import { redactingDiagnostics } from "#adapters/redactingDiagnostics.ts";
import { hostSensitiveKeys } from "#hostSensitiveKeys.ts";
import { otlpTracing } from "#otlpTracing.ts";
import { RedactionPolicy } from "#RedactionPolicy.ts";

export type HostSensitivePolicy = Effect.Success<ReturnType<typeof hostSensitiveKeys>>;

// Sql's collector keeps the owned models; the host also hands each model to the policy that masks its sensitive fields.
function maskedModels(sensitive: HostSensitivePolicy) {
	return Layer.effect(
		RepositoryModels,
		Effect.gen(function* () {
			const collected = yield* RepositoryModels;
			return RepositoryModels.of({
				declare: (declared) => Effect.andThen(sensitive.models.declare(Schema.Struct(declared.model.fields)), collected.declare(declared)),
				owned: collected.owned,
			});
		}),
	).pipe(Layer.provide(collectRepositoryModels));
}

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
				Layer.provide(maskedModels(sensitive)),
			),
		),
	);
}
