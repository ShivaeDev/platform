import { Effect, Layer } from "effect";
import { pgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { hostLayer, type InboxState } from "#test/host.ts";
import { postgresLayer } from "#test/postgresLayer.ts";
import { recordingTracer } from "#test/recordingTracer.ts";
import { webhookReceipts } from "#webhookReceipts.ts";

export const schemaInbox = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: (): InboxState => ({ client: undefined, logs: [], mode: "check", telemetry: recordingTracer(), url: "" }),
	layer: postgresLayer,
	name: "webhook receipt migrations",
	stages: [],
	verbs: (state) => ({
		apply: () => webhookReceipts.apply,
		checkHost: () => Layer.build(hostLayer(state)).pipe(Effect.scoped, Effect.exit),
		installJobs: () => pgBossSchema().apply,
		pending: () => webhookReceipts.pending,
	}),
});
