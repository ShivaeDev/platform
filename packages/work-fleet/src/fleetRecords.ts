import { Schema } from "effect";
import { collection } from "@shivaedev/effect-contract/keys.ts";

export const fleetRecords = collection("fleet", Schema.String);
