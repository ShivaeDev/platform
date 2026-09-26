import { Effect, Layer, Schema, Stream } from "effect";
import type { EffectProcedureRequestServices } from "../request-services.ts";
import { RequestSignal } from "../request-signal.ts";
import type { ProcedureInfo } from "../types.ts";
import { acceptParsedInput } from "./loose.ts";
import type { EffectSubscriptionResolver, ProcedureInvocation } from "./procedure-types.ts";
import type { RuntimeBridge } from "./runtime.ts";

export const makeSubscriptionHandler = <RuntimeRequirements, Context, ProvidedServices, LayerError>(
	runtime: RuntimeBridge<RuntimeRequirements>,
	resolver: EffectSubscriptionResolver<never, ProvidedServices | NoInfer<RuntimeRequirements>, unknown>,
	requestServices: EffectProcedureRequestServices<Context, ProvidedServices, LayerError>,
	procedure: Omit<ProcedureInfo, "path">,
	outputSchema?: Schema.ConstraintDecoder<unknown>,
) => {
	const tracedResolver = Effect.fnUntraced(acceptParsedInput(resolver));

	return async (invocation: ProcedureInvocation<Context>) => {
		const info = { ...procedure, path: invocation.path };
		const requestLayer = Layer.merge(requestServices.layer(invocation.ctx), Layer.succeed(RequestSignal, invocation.signal));
		const stream = Stream.unwrap(Effect.suspend(() => runtime.instrument(tracedResolver(invocation.input), info))).pipe(Stream.provide(requestLayer));
		const decoded = outputSchema === undefined ? stream : Stream.mapEffect(stream, (value) => Schema.decodeUnknownEffect(outputSchema)(value));

		return await runtime.runStream(decoded, {
			procedure: info,
			...(invocation.signal === undefined ? {} : { signal: invocation.signal }),
		});
	};
};
