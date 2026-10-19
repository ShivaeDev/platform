import { Effect } from "effect";
import { fakeHttpService } from "#fakeHttpService.ts";
import { storyKit } from "#storyKit.ts";
import { httpProbe } from "#test/httpProbe.ts";

export const scopedHttpApp = storyKit({
	clock: "live",
	*create() {
		const comments: { pull: string | undefined; text: string }[] = [];
		return yield* fakeHttpService({
			guard: ({ headers }) => headers["x-service-key"] === "story-key",
			routes: {
				comment: {
					method: "POST",
					path: "/repos/:owner/:repo/pulls/:number/comments",
					reply: ({ body, params }) => {
						const comment = { pull: params.number, text: body.toString() };
						comments.push(comment);
						return { body: comment, status: 201 };
					},
				},
				comments: { path: "/comments", reply: () => ({ body: comments }) },
				installation: {
					guard: ({ headers }) => headers.authorization === "Bearer installation-key",
					path: "/installations/:id",
					reply: ({ params }) => ({ body: { installation: params.id } }),
				},
				pull: { path: "/repos/:owner/:repo/pulls/:number", reply: ({ params }) => ({ body: params }) },
			},
		});
	},
	name: "scoped HTTP controls",
	stages: ["ready"],
	verbs: (service, story) => {
		service.narrate(story.tell);
		function request(path: string, options: { method?: string; token?: string; serviceKey?: string; body?: string } = {}) {
			const headers = { authorization: `Bearer ${options.token ?? "installation-key"}`, "x-service-key": options.serviceKey ?? "story-key" };
			return Effect.acquireRelease(
				Effect.sync(() => httpProbe(`${service.url}${path}`, { headers, method: options.method }, options.body)),
				(client) => client.abort,
			);
		}

		return {
			comments: () => Effect.tryPromise(async () => (await fetch(`${service.url}/comments`, { headers: { "x-service-key": "story-key" } })).json()),
			failOnce: service.failOnce,
			fault: service.fault,
			hold: service.hold,
			releaseOnArrival: service.releaseOnArrival,
			request,
			scriptFault: service.scriptFault,
			stall: service.stall,
		};
	},
});
