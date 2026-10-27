import { Data } from "effect";

export class WebhookUnauthorized extends Data.TaggedError("WebhookUnauthorized") {}
