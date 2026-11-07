import { Schema } from "effect";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { jobsPageWithRetry } from "#jobs/retryPage.ts";
import { adminRegistry } from "#registry.ts";
import { Users } from "#test/pages.ts";
import { ScheduledWorker } from "#test/ScheduledWorker.ts";

export const Mail = defineQueue({
	label: "Email delivery",
	name: "mail",
	schema: Schema.Struct({
		href: Schema.optionalKey(Schema.Redacted(Schema.String)),
		id: Schema.NumberFromString,
		token: Schema.optionalKey(Schema.String),
	}),
	subject: [
		{ field: "id", label: "Message" },
		{ field: "href", label: "Link" },
		{ field: "token", label: "Token" },
	],
});
export const Sync = defineQueue({ name: "sync", schema: Schema.Struct({ key: Schema.String }) });
export const Private = defineQueue({ name: "private", schema: Schema.Struct({ id: Schema.Number }) });
export function pages() {
	return adminRegistry(jobsPageWithRetry(Mail, Sync, ScheduledWorker), Users);
}
