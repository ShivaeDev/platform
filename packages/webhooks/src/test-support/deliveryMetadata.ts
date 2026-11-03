import { Schema } from "effect";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { webhookEvent, webhookJob } from "#server/registration.ts";

export const deliveryQueue = defineQueue({
	name: "webhook-delivery",
	queue: { notify: true },
	schema: Schema.Struct({
		delivery: Schema.Struct({ event: Schema.String, id: Schema.String, source: Schema.String }),
		number: Schema.Number,
	}),
});

export interface HandledDelivery {
	readonly jobId: string;
	readonly payload: typeof deliveryQueue.schema.Type;
}

export const deliveryEvent = webhookEvent(Schema.Struct({ issue: Schema.Struct({ number: Schema.Number }) }), ({ issue }, delivery) => [
	webhookJob(deliveryQueue, { delivery, number: issue.number }, { id: delivery.id }),
]);
