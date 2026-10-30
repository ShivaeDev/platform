import { Effect } from "effect";
import { fakeHttpService } from "#fakeHttpService.ts";
import { storyKit } from "#storyKit.ts";

function* brokenChunks(thrown: unknown) {
	yield "started";
	throw thrown;
}

export const brokenHttpApp = storyKit({
	clock: "live",
	*create() {
		const state: { thrown: unknown; source: "reply" | "guard" | "script" | "stream" } = { source: "reply", thrown: undefined };
		const service = yield* fakeHttpService({
			guard: () => {
				if (state.source === "guard") {
					throw state.thrown;
				}
				return true;
			},
			routes: {
				data: {
					path: "/data",
					reply: () => {
						if (state.source === "stream") {
							return { chunks: brokenChunks(state.thrown) };
						}
						throw state.thrown;
					},
				},
			},
		});
		return { service, state };
	},
	inspect: ({ service }) => service.requests.map(({ method, path, status }) => `${method} ${path} ${status}`),
	name: "broken fake",
	stages: ["ready"],
	verbs: ({ service }, story) => {
		service.narrate(story.tell);
		return {
			request: () =>
				Effect.promise(async () => {
					try {
						const response = await fetch(`${service.url}/data`);
						await response.text();
					} catch {
						story.tell("the application handled the connection error");
					}
				}),
		};
	},
});

export function handlerThrows(source: "reply" | "guard" | "script" | "stream", thrown: unknown) {
	return brokenHttpApp.trait("ready", `the fake's ${source} throws`, function* ({ service, state }) {
		state.source = source;
		state.thrown = thrown;
		if (source === "script") {
			yield* service.scriptFault("data", {
				kind: "status",
				reply: () => {
					throw thrown;
				},
			});
		}
	});
}
