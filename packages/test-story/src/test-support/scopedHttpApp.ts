import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { fakeHttpService } from "#server/fakeHttpService.ts";
import { storyKit } from "#server/storyKit.ts";
import { httpClient, type Send } from "#test/httpClient.ts";

interface Caller {
	readonly body?: string;
	readonly method?: string;
	readonly serviceKey?: string;
	readonly token?: string;
}

function sent(caller: Caller): Send {
	return {
		...(caller.body === undefined ? {} : { body: caller.body }),
		headers: { authorization: `Bearer ${caller.token ?? "installation-key"}`, "x-service-key": caller.serviceKey ?? "story-key" },
		...(caller.method === undefined ? {} : { method: caller.method }),
	};
}

export const scopedHttpApp = storyKit({
	clock: "test",
	*create() {
		const comments: string[] = [];
		const service = yield* fakeHttpService({
			guard: ({ headers }) => headers["x-service-key"] === "story-key",
			routes: {
				comment: {
					method: "POST",
					path: "/repos/:owner/:repo/pulls/:number/comments",
					reply: ({ body, params }) => {
						comments.push(`pull ${params.number}: ${body.toString()}`);
						return { body: { pull: params.number, text: body.toString() }, status: HttpStatus.fromLiteral("Created") };
					},
				},
				installation: {
					guard: ({ headers }) => headers.authorization === "Bearer installation-key",
					path: "/installations/:id",
					reply: ({ params }) => ({ body: { installation: params.id } }),
				},
				pull: { path: "/repos/:owner/:repo/pulls/:number", reply: ({ params }) => ({ body: params }) },
			},
		});
		return { comments, service };
	},
	inspect: ({ comments, service }) => ({ comments, requests: service.requests.map(({ method, path, status }) => `${method} ${path} ${status}`) }),
	name: "scoped HTTP controls",
	stages: ["ready"],
	verbs: ({ comments, service }, story) => {
		service.narrate(story.tell);
		const client = httpClient(() => service.url, story.tell);
		return {
			...client,
			asks: (path: string, caller: Caller = {}) => client.asks(path, sent(caller)),
			comments: () => Effect.sync(() => [...comments]),
			fault: service.fault,
			hold: service.hold,
			releaseOnArrival: service.releaseOnArrival,
			requests: () => Effect.sync(() => service.requests.map(({ method, path, status }) => `${method} ${path} ${status}`)),
			scriptFault: service.scriptFault,
			sends: (name: string, path: string, caller: Caller = {}) => client.sends(name, path, sent(caller)),
			stall: service.stall,
		};
	},
});
