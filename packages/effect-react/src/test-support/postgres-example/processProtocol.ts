import { Schema } from "effect";
import { Order } from "./contract.ts";

export const Configuration = Schema.Struct({
	applicationName: Schema.String,
	channel: Schema.String,
	databaseUrl: Schema.String,
	ledger: Schema.String,
	queue: Schema.String,
	role: Schema.Literals(["server", "worker"]),
	schema: Schema.String,
	table: Schema.String,
});
export type Configuration = typeof Configuration.Type;
export const Message = Schema.Union([
	Schema.Struct({ _tag: Schema.Literal("Close") }),
	Schema.Struct({ _tag: Schema.Literal("Reject") }),
	Schema.Struct({ _tag: Schema.Literal("Enqueue"), order: Order }),
]);
export const Response = Schema.Union([
	Schema.Struct({ _tag: Schema.Literal("Ready"), url: Schema.String }),
	Schema.Struct({ _tag: Schema.Literal("Rejected") }),
	Schema.Struct({ _tag: Schema.Literal("Handled") }),
	Schema.Struct({ _tag: Schema.Literal("Enqueued") }),
	Schema.Struct({ _tag: Schema.Literal("Failure"), message: Schema.String }),
]);
export type Response = typeof Response.Type;
