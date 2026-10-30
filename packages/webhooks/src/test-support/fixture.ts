import { Config, Schema } from "effect";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import { githubSource } from "#github.ts";
import { webhookEvent, webhookJob } from "#registration.ts";

export const WEBHOOK_SECRET = "webhook-story-signing-secret";
export const PRIVATE_FIELD = "private-body-field";
export const MAX_BODY_BYTES = 256;
export const Jobs = makePgBoss("@test/WebhooksJobs");
export const issueQueue = defineQueue({ name: "webhook-issue", queue: { notify: true }, schema: Schema.Struct({ number: Schema.Number }) });
export const auditQueue = defineQueue({ name: "webhook-audit", queue: { notify: true }, schema: Schema.Struct({ number: Schema.Number }) });
export const sources = {
	github: githubSource({
		events: {
			issues: webhookEvent(Schema.Struct({ action: Schema.String, issue: Schema.Struct({ number: Schema.Number }) }), ({ issue }) => [
				webhookJob(issueQueue, { number: issue.number }),
				webhookJob(auditQueue, { number: issue.number }),
			]),
			ping: webhookEvent(Schema.Struct({ zen: Schema.String }), () => []),
		},
		key: Config.Redacted("WEBHOOK_SECRET"),
	}),
};
