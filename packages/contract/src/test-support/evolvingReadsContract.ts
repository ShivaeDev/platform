import { Effect, Schema } from "effect";
import { contract } from "#contract.ts";
import { command, query } from "#operation.ts";
import { Create, Edit, Guard, lists, records, Timeline, TimelineData, Unavailable } from "#test/derivedReadsContract.ts";

const Leave = command("leave", {
	invalidates: ({ scope }) => [lists.bucket.scope(scope)],
	payload: { id: Schema.Number, scope: Schema.String },
	rejections: { Unavailable },
});
const Join = command("join", {
	invalidates: ({ scope }) => [lists.bucket.scope(scope)],
	payload: { id: Schema.Number, scope: Schema.String },
	rejections: { Unavailable },
});
const AddRecord = command("addRecord", {
	invalidates: ({ id, listId }) => [records.item(id), records.bucket.listId(listId)],
	payload: { body: Schema.String, id: Schema.Number, listId: Schema.Number },
	rejections: { Unavailable },
});
const Barrier = query("barrier", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [records.list],
	rejections: { Unavailable },
	success: Schema.Array(Schema.String),
});
export const EvolvingTimelines = contract("evolving", {
	commands: [Create, Edit, Leave, Join, AddRecord],
	queries: [
		Timeline,
		query("pushed", {
			payload: Timeline.payload,
			readPolicy: Timeline.readPolicy,
			reads: Timeline.reads,
			rejections: Timeline.rejections,
			serverReads: ({ scope }) => Effect.flatMap(TimelineData, (data) => data.keys(scope)),
			success: Timeline.success,
		}),
		Barrier,
	],
}).middleware(Guard);

export type Delivery = "timeline" | "pushed";
