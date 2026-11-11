import { Schema } from "effect";
import { JobFields } from "#jobs/schemas.ts";

export class JobsRow extends Schema.Class<JobsRow>("JobsRow")(JobFields) {}
