import { Effect, Layer, Schema, Stream } from "effect";
import { RequestSignal } from "#server/RequestSignal.ts";
import type { EffectProcedureRequestServices } from "#server/requestServices.ts";
import type { ProcedureInfo } from "#server/types.ts";
import { acceptParsedInput } from "./loose.ts";
import type { EffectSubscriptionResolver, ProcedureInvocation } from "./procedureTypes.ts";
import type { RuntimeBridge } from "./runtime.ts";
export function makeSubscriptionHandler<TRuntimeRequirements, TContext, TProvidedServices, TLayerError>(
	runtime: RuntimeBridge<TRuntimeRequirements>,
	resolver: EffectSubscriptionResolver<never, TProvidedServices | NoInfer<TRuntimeRequirements>, unknown>,
	requestServices: EffectProcedureRequestServices<TContext, TProvidedServices, TLayerError>,
	procedure: Omit<ProcedureInfo, "path">,
	outputSchema?: Schema.ConstraintDecoder<unknown>,
) {
	const tracedResolver = Effect.fnUntraced(acceptParsedInput(resolver));
	return async (invocation: ProcedureInvocation<TContext>) => {
		const info = { ...procedure, path: invocation.path };
		const stream = Stream.suspend(() => {
			const requestLayer = Layer.merge(requestServices.layer(invocation.ctx), Layer.succeed(RequestSignal, invocation.signal));
			return Stream.unwrap(Effect.suspend(() => runtime.instrument(tracedResolver(invocation.input), info))).pipe(Stream.provide(requestLayer));
		});
		const decoded = outputSchema === undefined ? stream : Stream.mapEffect(stream, (value) => Schema.decodeUnknownEffect(outputSchema)(value));
		return await runtime.runStream(decoded, {
			procedure: info,
			...(invocation.signal === undefined ? {} : { signal: invocation.signal }),
		});
	};
}
