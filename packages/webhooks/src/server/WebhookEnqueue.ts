import { Context } from "effect";
import type { PgBossService } from "@shivaedev/jobs/server/service.ts";

export class WebhookEnqueue extends Context.Service<WebhookEnqueue, Pick<PgBossService, "enqueue">>()("@shivaedev/webhooks/WebhookEnqueue") {}
