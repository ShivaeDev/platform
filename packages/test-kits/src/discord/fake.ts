import { Effect } from "effect";
import { discordRest } from "#discord/adapters/rest.ts";
import { discordGateway } from "#discord/gateway.ts";

export const fakeDiscord = Effect.fnUntraced(function* () {
	return { gateway: yield* discordGateway(), ...(yield* discordRest()) };
});
