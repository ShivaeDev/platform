import { Schema } from "effect";
import { collection } from "@shivaedev/contract/keys.ts";

export const jobsKeys = {
	counts: collection("admin.jobs.counts", Schema.String),
	deadLettered: collection("admin.jobs.deadLettered", Schema.String),
	failed: collection("admin.jobs.failed", Schema.String),
	health: collection("admin.jobs.health", Schema.String),
	job: (queue: string) => collection(`admin.jobs.job.${queue}`, Schema.String),
};
