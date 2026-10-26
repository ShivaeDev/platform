import { Schema } from "effect";
import { BadRequest, Conflict, Forbidden, NotFound, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";

export const fleetRejections = { BadRequest, Conflict, Forbidden, NotFound, ServiceUnavailable };
export const FleetError = Schema.Union(Object.values(fleetRejections));
export type FleetError = typeof FleetError.Type;
export const isFleetError = Schema.is(FleetError);
