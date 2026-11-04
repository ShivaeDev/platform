import { Context, type Redacted } from "effect";

export class DiscordToken extends Context.Service<DiscordToken, Redacted.Redacted<string>>()("@shivaedev/discord/DiscordToken") {}
