import { Effect } from "effect";
import { discordGateway } from "#discord/adapters/gateway.ts";
import { discordRest } from "#discord/adapters/rest.ts";

export const fakeDiscord = Effect.fnUntraced(function* () {
	return { gateway: yield* discordGateway(), ...(yield* discordRest()) };
});
