import { Schema } from "effect";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { jobsPageWithRetry } from "#jobs/retryPage.ts";
import { adminRegistry } from "#registry.ts";
import { Users } from "./pages.ts";
import { Scheduled } from "./Scheduled.ts";

export const Mail = defineQueue({
	name: "mail",
	schema: Schema.Struct({
		href: Schema.optionalKey(Schema.Redacted(Schema.String)),
		id: Schema.NumberFromString,
		token: Schema.optionalKey(Schema.String),
	}),
});
export const Sync = defineQueue({ name: "sync", schema: Schema.Struct({ key: Schema.String }) });
export const Private = defineQueue({ name: "private", schema: Schema.Struct({ id: Schema.Number }) });
export function pages() {
	return adminRegistry(jobsPageWithRetry({ name: Mail.name, schema: Mail.schema }, { name: Sync.name, schema: Sync.schema }, Scheduled), Users);
}
