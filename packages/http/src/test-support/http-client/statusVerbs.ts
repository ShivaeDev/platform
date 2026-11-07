import { Effect } from "effect";
import { HttpClientRequest } from "effect/http";
import { checkStatus } from "#checkStatus.ts";
import type { ClientEngine } from "#test/http-client/engine.ts";

export function statusVerbs({ client, rawClient, remote }: ClientEngine, story: { tell: (line: string) => void }) {
	return {
		checkResponse: (mode: "response" | "client") => {
			story.tell(`the client POSTs /answer?token=private and checks the ${mode} status`);
			const request = HttpClientRequest.post(`${remote.url}/answer?token=private`);
			return mode === "response" ? rawClient().execute(request).pipe(Effect.flatMap(checkStatus)) : client().execute(request);
		},
		remoteUrl: () => Effect.succeed(remote.url),
	};
}
