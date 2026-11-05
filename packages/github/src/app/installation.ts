import { Effect } from "effect";
import { GitHubClients } from "#GitHubClients.ts";
export const installation = Effect.fn("GitHubApp.installation")(function* (id: number) {
	const clients = yield* GitHubClients;
	return yield* clients.installation(id);
});
