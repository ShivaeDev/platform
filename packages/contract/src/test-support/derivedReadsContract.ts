import { Context, Effect, Option, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { collection, type Key } from "@shivaedev/changes/keys.ts";
import { contract } from "#contract.ts";
import { command, query } from "#operation.ts";
import { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";

export const records = collection("timeline", Schema.Number, { listId: Schema.Number, scope: Schema.String });
export class Unavailable extends Schema.TaggedError<Unavailable>()("Unavailable", {}) {}
export class TimelineData extends Context.Service<
	TimelineData,
	{
		readonly keys: (scope: string) => Effect.Effect<readonly Key[], Unavailable>;
		readonly load: (scope: string) => Effect.Effect<readonly string[], Unavailable>;
	}
>()("test/TimelineData") {}
export class Guard extends RpcMiddleware.Service<Guard>()("test/TimelineGuard", { error: Schema.Union([MissingReadPolicy, QueryReadDenied]) }) {}
export const Timeline = query("timeline", {
	payload: { scope: Schema.String },
	readPolicy: ({ scope }, viewer) => Effect.succeed(Option.exists(viewer, ({ id }) => id === scope)),
	reads: () => [],
	rejections: { Unavailable },
	serverReads: ({ scope }) => Effect.flatMap(TimelineData, (data) => data.keys(scope)),
	success: Schema.Array(Schema.String),
});
export const Edit = command("edit", {
	invalidates: (_payload, listId) => [records.bucket.listId(listId)],
	payload: { body: Schema.String, id: Schema.Number },
	rejections: { Unavailable },
	success: Schema.Number,
});
export const Create = command("create", {
	invalidates: ({ scope }) => [records.bucket.scope(scope)],
	payload: { body: Schema.String, id: Schema.Number, scope: Schema.String },
	rejections: { Unavailable },
});
export const Timelines = contract("timelines", { commands: [Edit, Create], queries: [Timeline] }).middleware(Guard);
