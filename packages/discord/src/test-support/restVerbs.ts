import type { Context } from "effect";
import { Effect, Fiber, Schema } from "effect";
import type { fakeDiscord } from "@shivaedev/test-kits/discord/fake.ts";
import { passes, untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import type { DiscordGateway } from "#DiscordGateway.ts";
import type { DiscordRest } from "#DiscordRest.ts";
import { request } from "#request.ts";

const Message = Schema.Struct({ channelId: Schema.String, content: Schema.String, id: Schema.String }).pipe(
	Schema.encodeKeys({ channelId: "channel_id" }),
);

type Engine = Effect.Success<ReturnType<typeof fakeDiscord>> & {
	context: Context.Context<Context.Service.Identifier<typeof DiscordRest> | Context.Service.Identifier<typeof DiscordGateway>>;
};

export function restVerbs(engine: Engine, tell: (line: string) => void) {
	function send(content: string, channel = "111") {
		return request("POST", `/channels/${channel}/messages`, Message, { content }).pipe(Effect.provide(engine.context));
	}
	let pending: Fiber.Fiber<Effect.Success<ReturnType<typeof send>>, Effect.Error<ReturnType<typeof send>>> | undefined;
	return {
		createMessage: (content: string, channel?: string) => send(content, channel),
		editMessage: (id: string, content: string) =>
			request("PATCH", `/channels/111/messages/${id}`, Message, { content }).pipe(Effect.provide(engine.context)),
		editMissingMessage: () =>
			request("PATCH", "/channels/111/messages/999", Message, { content: "absent" }).pipe(
				Effect.provide(engine.context),
				Effect.catchTag("RemoteNotFound", () => Effect.succeed("message not found")),
			),
		finalRetryIntervalPasses: () =>
			pending === undefined
				? Effect.die("Start a message first")
				: passes(
						"2 seconds",
						Fiber.join(pending).pipe(Effect.catchTag("DiscordRateLimited", (error) => Effect.succeed({ retryAfter: error.retryAfter }))),
					),
		history: () => request("GET", "/channels/111/messages", Schema.Array(Message)).pipe(Effect.provide(engine.context)),
		rateLimitIntervalPasses: () => {
			tell("two seconds pass before Discord accepts the next request");
			return pending === undefined ? Effect.die("Start a message before advancing its retry clock") : passes("2 seconds", Fiber.join(pending));
		},
		removeMessage: (id: string) => request("DELETE", `/channels/111/messages/${id}`, Schema.Void).pipe(Effect.provide(engine.context)),
		requests: () =>
			Effect.sync(() =>
				engine.server.requests.map(({ method, path, body, headers, status }) => ({
					authorization: headers.authorization,
					body: body.toString(),
					method,
					path,
					status,
				})),
			),
		retryIntervalPasses: () => passes("2 seconds", untilTimer("2 seconds")),
		startMessage: (content: string, channel?: string) =>
			Effect.gen(function* () {
				tell("the bot starts sending a message");
				pending = yield* send(content, channel).pipe(Effect.forkScoped);
			}),
		waitForRateLimit: () => untilTimer("2 seconds"),
	};
}
