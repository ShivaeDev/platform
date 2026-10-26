import { Context } from "effect";

export const GitHubConfig = Context.Reference<{ readonly apiUrl: string; readonly responseByteLimit?: number }>("@shivaedev/github/GitHubConfig", {
	defaultValue: () => ({ apiUrl: "https://api.github.com" }),
});
