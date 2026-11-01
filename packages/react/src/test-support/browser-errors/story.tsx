import { Effect, Queue } from "effect";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Screen } from "#test/Screen.ts";
import { Reporter } from "./Reporter.tsx";

function browserEvent(kind: "error" | "unhandledrejection", reason: Error | string) {
	if (kind === "error") {
		return new ErrorEvent("error", { error: reason, message: String(reason) });
	}
	return Object.assign(new Event("unhandledrejection"), { promise: Promise.resolve(), reason });
}

export const browserErrorsStory = storyKit({
	clock: "live",
	*create() {
		const received = yield* Queue.unbounded<void>();
		const server = yield* fakeHttpService({
			routes: {
				report: {
					method: "POST",
					path: "/_platform/errors",
					reply: () => {
						Queue.offerUnsafe(received, undefined);
						return { status: 202 };
					},
				},
			},
		});
		const pending: Promise<Response>[] = [];
		const fetcher = globalThis.fetch;
		const previousUrl = window.location.href;
		window.location.href = `${server.url}/notes`;
		globalThis.fetch = (input, init) => {
			const request = fetcher(new URL(String(input), window.location.href), init);
			pending.push(request);
			return request;
		};
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				globalThis.fetch = fetcher;
				window.location.href = previousUrl;
			}),
		);
		const screen = new Screen(() => undefined);
		const view = yield* screen.open(<Reporter />);
		return { pending, received, screen, server, view };
	},
	inspect: ({ server }) => ({ requests: server.requests }),
	name: "browser error reporting",
	stages: ["mounted"],
	verbs: ({ pending, received, screen, server, view }, story) => {
		screen.tell = story.tell;
		return {
			emit: (kind: "error" | "unhandledrejection", reason: Error | string) =>
				screen
					.act(`the browser emits ${kind}`, () => window.dispatchEvent(browserEvent(kind, reason)))
					.pipe(Effect.andThen(Effect.promise(() => Promise.all(pending)))),
			received: () => Queue.take(received),
			reports: () => Effect.sync(() => server.requests.map(({ body, method, path }) => ({ body: JSON.parse(body.toString()), method, path }))),
			unmount: () => screen.act("the reporting component unmounts", view.unmount),
		};
	},
});
