import { type Context, Layer } from "effect";
import type { PgBossInspectionService } from "#server/inspection.ts";
import { inspection } from "./inspection.ts";
import { operationsLayer } from "./operationsLayer.ts";
export function inspectionLayer<TIdentifier extends string>(service: Context.Service<TIdentifier, PgBossInspectionService>) {
	return Layer.effect(service, inspection()).pipe(Layer.provide(operationsLayer([])));
}
