import { Context } from "effect";

export const DiscordConfig = Context.Reference<{
	readonly apiUrl: string;
	readonly gatewayUrl: string;
	readonly intents: number;
}>("@shivaedev/discord/DiscordConfig", {
	defaultValue: () => ({ apiUrl: "https://discord.com/api/v10", gatewayUrl: "wss://gateway.discord.gg", intents: 0 }),
});
