import { Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";

export const fleetRecords = collection("fleet", Schema.String);
