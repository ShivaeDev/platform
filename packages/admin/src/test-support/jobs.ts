import { Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";

export const jobs = collection("jobs", Schema.String);
