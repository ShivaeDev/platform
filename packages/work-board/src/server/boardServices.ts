import { type Context, Layer } from "effect";
import { Diagnostics, DiagnosticsConfig } from "#diagnostics/source.ts";
import { HandoffsService } from "#server/handoffs/Service.ts";
import { ResponseConfig, type ResponseOptions, Responses } from "#server/responses/service.ts";

export function boardServices(options: ResponseOptions, diagnostics: Context.Service.Shape<typeof DiagnosticsConfig>) {
	return Layer.mergeAll(Responses.layer, HandoffsService.layer, Diagnostics.layer).pipe(
		Layer.provide(Layer.merge(Layer.succeed(ResponseConfig, options), Layer.succeed(DiagnosticsConfig, diagnostics))),
	);
}
