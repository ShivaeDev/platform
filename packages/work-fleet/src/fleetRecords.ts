import { Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";

export const fleetRecords = collection("fleet", Schema.String);
export const fleetScheduling = collection("fleet-scheduling", Schema.String);
