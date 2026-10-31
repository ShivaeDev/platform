import { Redacted, Schema } from "effect";
import { defineQueue } from "#definition.ts";
import { enqueued, running } from "#test/postgres/traits.ts";
import { workerBy } from "#test/workers.ts";

export const Mail = defineQueue({
	name: "one-time-mail",
	queue: { retryLimit: 0 },
	schema: Schema.Struct({
		links: Schema.Array(Schema.Struct({ href: Schema.Redacted(Schema.String) })),
		note: Schema.RedactedFromValue(Schema.String),
		subject: Schema.String,
		token: Schema.String,
	}),
});
export const LINK = "https://example.com/confirm/one-time-value";
export const payload = {
	links: [{ href: Redacted.make(LINK) }],
	note: Redacted.make("private note"),
	subject: "Confirm your email",
	token: "one-time-token",
};
export const queued = [
	running(
		"app",
		[
			workerBy(Mail, (received) => ({
				afterwards: {
					afterwards: { failsWith: { _tag: "DeliveryRejected", payload: received } },
					logs: "mail attempted",
				},
				logs: received,
			})),
		],
		{ startsUnderLogAnnotations: { component: "mail", token: payload.token } },
	),
	enqueued(Mail, payload, { as: "confirmation", underSpan: "request" }),
];

export function receivedValues(received: readonly unknown[]) {
	return Schema.decodeUnknownSync(Schema.Array(Schema.toType(Mail.schema)))(received).map(({ links, note, token }) => ({
		links: links.map(({ href }) => Redacted.value(href)),
		note: Redacted.value(note),
		token,
	}));
}
