import { Config, Schema } from "effect";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import { githubSource } from "#github.ts";
import { webhookEvent, webhookJob } from "#registration.ts";

export const WEBHOOK_SECRET = "webhook-story-signing-secret";
export const body = JSON.stringify({ action: "opened", issue: { number: 42 }, private: "unlogged-body-marker" });
export const Jobs = makePgBoss("@test/WebhooksJobs");
export const issueQueue = defineQueue({ name: "webhook-issue", schema: Schema.Struct({ number: Schema.Number }) });
export const auditQueue = defineQueue({ name: "webhook-audit", schema: Schema.Struct({ number: Schema.Number }) });
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
