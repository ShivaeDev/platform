import { Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";

export const schedulerInputs = collection("fleet-scheduler-inputs", Schema.String);
