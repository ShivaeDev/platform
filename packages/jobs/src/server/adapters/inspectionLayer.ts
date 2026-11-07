import { type Context, Layer } from "effect";
import { inspection } from "#server/adapters/inspection.ts";
import { operationsLayer } from "#server/adapters/operationsLayer.ts";
import type { PgBossInspectionService } from "#server/inspection.ts";
export function inspectionLayer<TIdentifier extends string>(service: Context.Service<TIdentifier, PgBossInspectionService>) {
	return Layer.effect(service, inspection()).pipe(Layer.provide(operationsLayer([])));
}
