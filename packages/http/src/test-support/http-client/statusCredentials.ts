import { NodeHttpClient } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpClient } from "effect/http";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { RemoteStatusError } from "#errors.ts";
import { filterStatus } from "#filterStatus.ts";

export const statusCredentials = storyKit({
	*create() {
		const remote = yield* fakeHttpService({
			routes: { answer: { path: "/answer/:status", reply: ({ params }) => ({ status: Number(params.status) }) } },
		});
		const context = yield* Layer.build(NodeHttpClient.layerNodeHttp);
		const client = filterStatus(yield* HttpClient.HttpClient.pipe(Effect.provide(context)));
		const failures: RemoteStatusError[] = [];
		return { client, failures, remote };
	},
	name: "status error credentials",
	stages: [],
	verbs: ({ client, failures, remote }, story) => {
		remote.narrate(story.tell);
		function record(error: RemoteStatusError) {
			return Effect.sync(() => {
				failures.push(error);
			});
		}
		return {
			failure: () => Effect.sync(() => failures.at(-1)),
			refuse: (status: number, userinfo: string) => {
				story.tell(`the client requests an HTTP ${status} answer using URL credentials`);
				return client.get(`${remote.url.replace("://", `://${userinfo}@`)}/answer/${status}?token=private#secret`).pipe(
					Effect.catchTags({
						RemoteGone: record,
						RemoteHttpError: record,
						RemoteNotFound: record,
						RemoteRateLimited: record,
						RemoteUnauthorized: record,
					}),
				);
			},
			remoteUrl: () => Effect.succeed(remote.url),
		};
	},
});
