import { Effect, Layer, Schema, Stream } from "effect";
import type { EffectProcedureRequestServices } from "../request-services.js";
import { RequestSignal } from "../request-signal.js";
import type { ProcedureInfo } from "../types.js";
import type { EffectSubscriptionResolver } from "./procedure-types.js";
import type { RuntimeBridge } from "./runtime.js";

interface SubscriptionInvocation<Context, Input> {
	readonly ctx: Context;
	readonly input: Input;
	readonly path: string;
	readonly signal?: AbortSignal;
}

export const makeSubscriptionHandler = <
	RuntimeRequirements,
	Context,
	Input,
	ProvidedServices,
	LayerError,
	Output,
>(
	runtime: RuntimeBridge<RuntimeRequirements>,
	resolver: EffectSubscriptionResolver<
		Input,
		ProvidedServices | NoInfer<RuntimeRequirements>,
		Output
	>,
	requestServices: EffectProcedureRequestServices<
		Context,
		ProvidedServices,
		LayerError
	>,
	procedure: Omit<ProcedureInfo, "path">,
	outputSchema?: Schema.ConstraintDecoder<unknown>,
) => {
	const tracedResolver = Effect.fnUntraced(resolver);

	return async (invocation: SubscriptionInvocation<Context, Input>) => {
		const info = { ...procedure, path: invocation.path };
		const requestLayer = Layer.merge(
			requestServices.layer(invocation.ctx),
			Layer.succeed(RequestSignal, invocation.signal),
		);
		let stream = Stream.unwrap(
			Effect.suspend(() =>
				runtime.instrument(tracedResolver(invocation.input), info),
			),
		).pipe(Stream.provide(requestLayer));
		if (outputSchema !== undefined) {
			stream = Stream.mapEffect(stream, (value) =>
				Schema.decodeUnknownEffect(outputSchema)(value),
			) as typeof stream;
		}

		return await runtime.runStream(stream, {
			procedure: info,
			...(invocation.signal === undefined ? {} : { signal: invocation.signal }),
		});
	};
};
