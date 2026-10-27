import { Schema } from "effect";
import { FleetItemsProjection } from "./FleetItemsProjection.ts";
import { GoalsProjection } from "./GoalsProjection.ts";

export const OverviewProjection = Schema.Struct({ fleet: FleetItemsProjection, goals: GoalsProjection });
