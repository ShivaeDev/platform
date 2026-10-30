import { Schema } from "effect";

export const Receipt = Schema.Struct({
	deliveryId: Schema.String,
	event: Schema.String,
	jobIds: Schema.Array(Schema.String),
	outcome: Schema.Literals(["queued", "ignored"]),
	receivedAt: Schema.Date,
	source: Schema.String,
}).pipe(Schema.encodeKeys({ deliveryId: "delivery_id", jobIds: "job_ids", receivedAt: "received_at" }));
