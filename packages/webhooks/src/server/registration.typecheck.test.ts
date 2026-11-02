import { Config, Context, Data, Effect, type Layer, Redacted, Schema } from "effect";
import { expectTypeOf } from "vitest";
import { githubSource } from "#server/github.ts";
import { webhookEvent, webhookJob } from "#server/registration.ts";
import { webhookRoute } from "#server/route.ts";
import type { WebhookPayloadError } from "#server/WebhookPayloadError.ts";
import { issueQueue, Jobs } from "#test/fixture.ts";
import { SenderCheckFailed, SenderPreferences } from "#test/senderCheck.ts";

class OtherService extends Context.Service<OtherService, number>()("@test/OtherService") {}
class OtherFailure extends Data.TaggedError("OtherFailure") {}

const Payload = Schema.Struct({ number: Schema.Number });
const pure = webhookEvent(Payload, (payload) => [webhookJob(issueQueue, payload)]);
const checked = webhookEvent(Payload, (payload) =>
	Effect.gen(function* () {
		const preferences = yield* SenderPreferences;
		return (yield* preferences.allows("alice", 0)) ? [webhookJob(issueQueue, payload)] : [];
	}),
);
const other = webhookEvent(Payload, () => Effect.flatMap(OtherService, () => Effect.fail(new OtherFailure())));
const source = githubSource({ events: { checked, other, pure }, key: Config.succeed(Redacted.make("compile-only")) });
const separateSources = webhookRoute({
	basePath: "/hooks",
	jobs: Jobs,
	sources: {
		first: githubSource({ events: { checked }, key: Config.succeed(Redacted.make("compile-only")) }),
		second: githubSource({ events: { other }, key: Config.succeed(Redacted.make("compile-only")) }),
	},
});
expectTypeOf<Extract<Layer.Services<typeof separateSources>, SenderPreferences | OtherService>>().toEqualTypeOf<SenderPreferences | OtherService>();
const route = webhookRoute({ basePath: "/hooks", jobs: Jobs, sources: { github: source } });

expectTypeOf<Effect.Error<ReturnType<typeof checked.decode>>>().toEqualTypeOf<WebhookPayloadError | SenderCheckFailed>();
expectTypeOf<Effect.Services<ReturnType<typeof checked.decode>>>().toEqualTypeOf<SenderPreferences>();
expectTypeOf<Effect.Error<ReturnType<typeof pure.decode>>>().toEqualTypeOf<WebhookPayloadError>();
expectTypeOf<Effect.Services<ReturnType<typeof pure.decode>>>().toEqualTypeOf<never>();
expectTypeOf<Extract<Layer.Services<typeof route>, SenderPreferences | OtherService>>().toEqualTypeOf<SenderPreferences | OtherService>();

// @ts-expect-error Providing all other services still leaves the mapping's service required.
const missingCheck: Layer.Layer<
	Layer.Success<typeof route>,
	Layer.Error<typeof route>,
	Exclude<Layer.Services<typeof route>, SenderPreferences>
> = route;
void missingCheck;

const refused = webhookEvent(Payload, () => Effect.fail(new SenderCheckFailed()));
expectTypeOf<Effect.Error<ReturnType<typeof refused.decode>>>().toEqualTypeOf<WebhookPayloadError | SenderCheckFailed>();
