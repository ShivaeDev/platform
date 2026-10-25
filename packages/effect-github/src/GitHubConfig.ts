import { Context } from "effect";

export const GitHubConfig = Context.Reference<{ readonly apiUrl: string }>("@shivaedev/effect-github/GitHubConfig", {
	defaultValue: () => ({ apiUrl: "https://api.github.com" }),
});
