import { Config, Effect } from "effect";

export const ciBase = Effect.gen(function* () {
	const configured = yield* Config.String("CHANGELOG_BASE_REF").pipe(Config.withDefault(""));
	const event = yield* Config.String("GITHUB_EVENT_NAME").pipe(Config.withDefault(""));
	if (configured === "") {
		return undefined;
	}
	return event === "pull_request" ? "HEAD^1" : configured;
});
