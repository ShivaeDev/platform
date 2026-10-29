import { SqlClient } from "effect/sql";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type InboxState, startHost } from "#test/host.ts";
import { postgresLayer } from "#test/postgresLayer.ts";
import { queueVerbs } from "#test/queueVerbs.ts";
import { receiptHold } from "#test/receiptHold.ts";
import { recordingTracer } from "#test/recordingTracer.ts";
import { type DeliveryOptions, deliver } from "#test/requests.ts";

export interface Receipt {
	readonly "delivery_id": string;
	readonly event: string;
	readonly "job_ids": readonly string[];
	readonly outcome: string;
	readonly "received_at": Date;
	readonly source: string;
}

export const inbox = storyKit({
	after: { configured: startHost },
	around: withIsolatedDatabase,
	clock: "live",
	create: (): InboxState => ({ client: undefined, logs: [], mode: undefined, telemetry: recordingTracer(), url: "" }),
	layer: postgresLayer,
	name: "webhook inbox",
	stages: ["configured"],
	verbs: (state, story) => ({
		deliver: (options?: DeliveryOptions) => {
			story.tell(`receive ${options?.event === null ? "an unnamed event" : (options?.event ?? "issues")} from ${options?.source ?? "github"}`);
			return deliver(state, options);
		},
		receipts: () => SqlClient.SqlClient.use((sql) => sql<Receipt>`select * from webhook_receipts order by delivery_id`.withoutTransform),
		...queueVerbs(state),
		...receiptHold(),
		restoreReceipts: () => SqlClient.SqlClient.use((sql) => sql`alter table webhook_receipts_offline rename to webhook_receipts`),
		takeReceiptsOffline: () => SqlClient.SqlClient.use((sql) => sql`alter table webhook_receipts rename to webhook_receipts_offline`),
		telemetry: () => ({
			logs: state.logs,
			spans: state.telemetry.spans.map(({ name, attributes, events, status }) => ({
				attributes: [...attributes],
				events: events.map(([eventName, , fields]) => ({ fields, name: eventName })),
				exit: status._tag === "Ended" ? status.exit : undefined,
				name,
			})),
		}),
	}),
});
