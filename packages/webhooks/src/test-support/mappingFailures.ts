import { Data, Effect, Schema } from "effect";
import { RequestBodyTooLarge } from "@shivaedev/http/server/boundedBody.ts";
import { webhookEvent } from "#server/registration.ts";
import { WebhookUnauthorized } from "#server/WebhookUnauthorized.ts";

class MappingUnavailable extends Data.TaggedError("MappingUnavailable") {}

const Payload = Schema.Struct({ issue: Schema.Struct({ number: Schema.Number }) });

export const mappingFailures = {
	"body_limit_failure": webhookEvent(Payload, () => Effect.fail(new RequestBodyTooLarge({ limit: 256 }))),
	"frozen_failure": webhookEvent(Payload, () => Effect.fail(Object.freeze(new MappingUnavailable()))),
	"schema_failure": webhookEvent(Payload, () => Schema.decodeUnknownEffect(Schema.Array(Schema.Number))(["unavailable"]).pipe(Effect.as([]))),
	"unauthorized_failure": webhookEvent(Payload, () => Effect.fail(new WebhookUnauthorized())),
};
