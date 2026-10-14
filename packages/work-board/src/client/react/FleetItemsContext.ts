import { createContext } from "react";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
export const FleetItemsContext = createContext<FleetItemsProjection | undefined>(undefined);
