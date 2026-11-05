import type * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { Effect, Layer } from "effect";
import { redactingDiagnostics } from "#redactingDiagnostics.ts";

export type HostPreflight<TServices = never, TError = never, TRequirements = never> =
	| { readonly preflight: Layer.Layer<TServices, TError, TRequirements> }
	| ([TServices | TError | TRequirements] extends [never] ? { readonly preflight?: never } : never);

type HostCrypto = Layer.Success<typeof NodeCrypto.layer>;

export type PreflightHost<THost extends Layer.Any, TServices, TError, TRequirements> = Layer.Layer<
	Layer.Success<THost> | TServices,
	Layer.Error<THost> | TError,
	Exclude<Layer.Services<THost>, TServices | HostCrypto> | Exclude<TRequirements, HostCrypto>
>;

export function hostPreflight<TServices, TError, TRequirements, TSensitiveError>(
	startup: Layer.Layer<TServices, TError, TRequirements> | undefined,
	sensitive: Effect.Effect<(key: string) => boolean, TSensitiveError>,
) {
	return Layer.mergeAll(
		Layer.empty,
		...(startup === undefined ? [] : [Layer.unwrap(Effect.map(sensitive, (policy) => startup.pipe(Layer.provide(redactingDiagnostics(policy)))))]),
	);
}
