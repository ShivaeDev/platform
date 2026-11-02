import { Data, Effect, Schema } from "effect";
import { RequestBodyTooLarge } from "@shivaedev/http/server/boundedBody.ts";
import { webhookEvent } from "#server/registration.ts";
import { WebhookUnauthorized } from "#server/WebhookUnauthorized.ts";

class MappingUnavailable extends Data.TaggedError("MappingUnavailable") {}
class PayloadRejected extends Data.TaggedError("PayloadRejected")<{
	readonly message: string;
	readonly title: string;
	readonly cause: unknown;
}> {}

const Payload = Schema.Struct({ issue: Schema.Struct({ number: Schema.Number }) });

export const mappingFailures = {
	"body_limit_failure": webhookEvent(Payload, () => Effect.fail(new RequestBodyTooLarge({ limit: 256 }))),
	"frozen_failure": webhookEvent(Payload, () => Effect.fail(Object.freeze(new MappingUnavailable()))),
	"payload_defect": webhookEvent(Schema.Struct({ title: Schema.String }), ({ title }) => Effect.die(new Error(title))),
	"payload_failure": webhookEvent(Schema.Struct({ title: Schema.String }), ({ title }) =>
		Effect.fail(new PayloadRejected({ cause: new Error(title), message: title, title })),
	),
	"payload_string_failure": webhookEvent(Schema.Struct({ title: Schema.String }), ({ title }) => Effect.fail(title)),
	"schema_failure": webhookEvent(Payload, () => Schema.decodeUnknownEffect(Schema.Array(Schema.Number))(["unavailable"]).pipe(Effect.as([]))),
	"unauthorized_failure": webhookEvent(Payload, () => Effect.fail(new WebhookUnauthorized())),
};
