import { Effect, Layer, Redacted, Schema } from "effect";
import { pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { defineEmailQueue } from "./defineEmailQueue.ts";

const Message = Schema.Union([
	Schema.Struct({ _tag: Schema.Literal("Confirm"), url: Schema.Redacted(Schema.String) }),
	Schema.Struct({ _tag: Schema.Literal("Reset"), url: Schema.Redacted(Schema.String) }),
]);
function render(message: typeof Message.Type) {
	return Effect.succeed({
		from: "app@example.test",
		html: "Confirm",
		subject: message._tag,
		text: Redacted.value(message.url),
		to: "alice@example.test",
	});
}
const Default = defineEmailQueue(Message, render);
const Named = defineEmailQueue(Message, render, { name: "auth-emails" });
const client = pgBossLayer({ connectionString: Redacted.make("postgresql://compile-only") });
const namedProducer = Named.producerLayer.pipe(Layer.provide(client));
const confirmation = Default.enqueue({ _tag: "Confirm", url: Redacted.make("https://app.test/confirm") });

// @ts-expect-error A named producer does not provide the default email queue's service.
Effect.runPromise(confirmation.pipe(Effect.provide(namedProducer)));
Effect.runPromise(confirmation.pipe(Effect.provide(Default.producerLayer.pipe(Layer.provide(client)))));
// @ts-expect-error The message union rejects unknown variants.
Default.enqueue({ _tag: "Other", url: Redacted.make("https://app.test/confirm") });
// @ts-expect-error A one-time link must stay redacted until rendering.
Default.enqueue({ _tag: "Reset", url: "https://app.test/reset" });
