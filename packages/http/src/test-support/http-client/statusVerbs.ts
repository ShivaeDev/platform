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
		checkResponseAfterReadingText: () => {
			story.tell("the client POSTs /answer, reads the answer as text and then checks its status");
			return rawClient()
				.execute(HttpClientRequest.post(`${remote.url}/answer`))
				.pipe(
					Effect.tap((response) => response.text),
					Effect.flatMap(checkStatus),
					Effect.as("passed"),
					Effect.catchTag("RemoteHttpError", (error) => Effect.succeed(`HTTP ${error.status}, ${error.bodyExcerpt ?? "no excerpt"}`)),
				);
		},
		remoteUrl: () => Effect.succeed(remote.url),
	};
}
