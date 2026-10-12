import { Effect } from "effect";
import type { EffectProcedureRequestServices } from "#request-services.ts";
import type { ProcedureInfo } from "#types.ts";
import { acceptParsedInput } from "./loose.ts";
import type { EffectProcedureResolver, ProcedureInvocation } from "./procedureTypes.ts";
import type { RuntimeBridge } from "./runtime.ts";
export function makeProcedureHandler<TRuntimeRequirements, TContext, TProvidedServices, TLayerError>(
	runtime: RuntimeBridge<TRuntimeRequirements>,
	resolver: EffectProcedureResolver<never, TProvidedServices | NoInfer<TRuntimeRequirements>, unknown>,
	requestServices: EffectProcedureRequestServices<TContext, TProvidedServices, TLayerError>,
	procedure: Omit<ProcedureInfo, "path">,
) {
	const tracedResolver = Effect.fnUntraced(acceptParsedInput(resolver));
	return async (invocation: ProcedureInvocation<TContext>) => {
		const info = { ...procedure, path: invocation.path };
		const provided = Effect.suspend(() =>
			runtime.instrument(tracedResolver(invocation.input), info).pipe(Effect.provide(requestServices.layer(invocation.ctx))),
		);
		return await runtime.runEffect(provided, {
			procedure: info,
			...(invocation.signal === undefined ? {} : { signal: invocation.signal }),
		});
	};
}
