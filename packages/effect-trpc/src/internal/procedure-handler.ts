import { Effect } from "effect";
import type { EffectProcedureRequestServices } from "#request-services.ts";
import type { ProcedureInfo } from "#types.ts";
import { acceptParsedInput } from "./loose.ts";
import type { EffectProcedureResolver, ProcedureInvocation } from "./procedure-types.ts";
import type { RuntimeBridge } from "./runtime.ts";

export const makeProcedureHandler = <RuntimeRequirements, Context, ProvidedServices, LayerError>(
	runtime: RuntimeBridge<RuntimeRequirements>,
	resolver: EffectProcedureResolver<never, ProvidedServices | NoInfer<RuntimeRequirements>, unknown>,
	requestServices: EffectProcedureRequestServices<Context, ProvidedServices, LayerError>,
	procedure: Omit<ProcedureInfo, "path">,
) => {
	const tracedResolver = Effect.fnUntraced(acceptParsedInput(resolver));

	return async (invocation: ProcedureInvocation<Context>) => {
		const info = { ...procedure, path: invocation.path };
		const provided = Effect.suspend(() =>
			runtime.instrument(tracedResolver(invocation.input), info).pipe(Effect.provide(requestServices.layer(invocation.ctx))),
		);
		return await runtime.runEffect(provided, {
			procedure: info,
			...(invocation.signal === undefined ? {} : { signal: invocation.signal }),
		});
	};
};
