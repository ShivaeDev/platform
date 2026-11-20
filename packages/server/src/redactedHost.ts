import { Effect, Layer, Schema } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { type OwnedModel, type RepositoryModel, RepositoryModels } from "@shivaedev/sql/RepositoryModels.ts";
import { redactingDiagnostics } from "#adapters/redactingDiagnostics.ts";
import { hostSensitiveKeys } from "#hostSensitiveKeys.ts";
import { otlpTracing } from "#otlpTracing.ts";
import { RedactionPolicy } from "#RedactionPolicy.ts";

export type HostSensitivePolicy = Effect.Success<ReturnType<typeof hostSensitiveKeys>>;

// Keyed by table, so a repository built again over the same table replaces its entry instead of growing the list.
function collectedModels(sensitive: HostSensitivePolicy) {
	const owned = new Map<string, OwnedModel>();
	function record({ model, owner, table }: RepositoryModel) {
		return Effect.andThen(
			sensitive.models.declare(Schema.Struct(model.fields)),
			Effect.sync(() => {
				if (owner !== undefined) {
					owned.set(table, { model, owner, table });
				}
			}),
		);
	}
	return RepositoryModels.of({ declare: record, owned: Effect.sync(() => [...owned.values()]) });
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
				Layer.provide(Layer.succeed(RepositoryModels, collectedModels(sensitive))),
			),
		),
	);
}
