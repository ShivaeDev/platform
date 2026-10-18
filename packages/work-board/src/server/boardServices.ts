import { Layer } from "effect";
import { Diagnostics } from "#diagnostics/source.ts";
import { HandoffsService } from "#server/handoffs/Service.ts";
import { Responses } from "#server/Responses.ts";
import type { HandlerOptions } from "#server/rpc/HandlerOptions.ts";
import { handlers } from "#server/rpc/handlers.ts";

export function boardServices(options: HandlerOptions = {}) {
	return Layer.unwrap(handlers(options)).pipe(Layer.provideMerge(Layer.mergeAll(Responses.layer, HandoffsService.layer, Diagnostics.layer)));
}
