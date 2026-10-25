import { Schema } from "effect";
import { defineQueue } from "@shivaedev/effect-pg-boss/server/definition.ts";
import { jobsPageWithRetry } from "#jobs/retryPage.ts";
import { adminRegistry } from "#registry.ts";
import { Users } from "./pages.ts";

export const Mail = defineQueue({ name: "mail", schema: Schema.Struct({ id: Schema.NumberFromString }) });
export const Sync = defineQueue({ name: "sync", schema: Schema.Struct({ key: Schema.String }) });
export const Private = defineQueue({ name: "private", schema: Schema.Struct({ id: Schema.Number }) });
export function pages() {
	return adminRegistry(jobsPageWithRetry({ name: Mail.name, schema: Mail.schema }, { name: Sync.name, schema: Sync.schema }), Users);
}
