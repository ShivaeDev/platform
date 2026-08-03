import { Effect } from "effect";
import type { EffectProcedureRequestServices } from "../request-services.js";
import type { ProcedureInfo } from "../types.js";
import type { EffectProcedureResolver } from "./procedure-types.js";
import type { RuntimeBridge } from "./runtime.js";

interface ProcedureInvocation<Context, Input> {
	readonly ctx: Context;
	readonly input: Input;
	readonly path: string;
	readonly signal?: AbortSignal;
}

export const makeProcedureHandler = <
	RuntimeRequirements,
	Context,
	Input,
	ProvidedServices,
	LayerError,
	Output,
>(
	runtime: RuntimeBridge<RuntimeRequirements>,
	resolver: EffectProcedureResolver<
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
) => {
	const tracedResolver = Effect.fnUntraced(resolver);

	return async (invocation: ProcedureInvocation<Context, Input>) => {
		const provided = Effect.suspend(() =>
			tracedResolver(invocation.input).pipe(
				Effect.provide(requestServices.layer(invocation.ctx)),
			),
		);
		return await runtime.runEffect(provided, {
			procedure: { ...procedure, path: invocation.path },
			...(invocation.signal === undefined ? {} : { signal: invocation.signal }),
		});
	};
};
