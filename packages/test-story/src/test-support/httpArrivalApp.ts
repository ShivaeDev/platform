import { type Duration, Effect, Fiber } from "effect";
import { type FakeHttpRequestRecord, fakeHttpService } from "#fakeHttpService.ts";
import { storyKit } from "#storyKit.ts";
import { type SignalNotReceived, until } from "#until.ts";
import { httpClient } from "./httpClient.ts";

export const httpArrivalApp = storyKit({
	clock: "live",
	*create() {
		let title = "Original";
		const service = yield* fakeHttpService({
			guard: ({ headers }) => headers.authorization !== "rejected",
			routes: {
				item: {
					path: "/items/:id",
					reply: ({ params, query }) => ({ body: { id: params.id, title, value: query.get("value") } }),
				},
				title: {
					method: "POST",
					path: "/title",
					reply: ({ body }) => {
						title = body.toString();
						return { body: { title } };
					},
				},
			},
		});
		return { service };
	},
	inspect: ({ service }) => service.requests.map(({ method, path, status }) => `${method} ${path} ${status}`),
	name: "HTTP arrivals",
	stages: ["ready"],
	verbs: ({ service }, story) => {
		service.narrate(story.tell);
		const client = httpClient(
			() => service.url,
			story.tell,
			() => ({}),
			(path) => service.untilAbandoned((request) => request.path === path, { name: `abandoned ${path}` }),
		);
		const watchers = new Map<string, Fiber.Fiber<FakeHttpRequestRecord, SignalNotReceived>>();
		function receipt(path: string) {
			return until(service.received, (request) => request.path === path, { name: `received ${path}` });
		}
		return {
			...client,
			changesTitle: (title: string) => {
				story.tell(`the upstream title changes to ${title}`);
				return client.asks("/title", { body: title, method: "POST" });
			},
			completion: (path: string, timeout: Duration.Input = "5 seconds") =>
				until(service.completed, (request) => request.path === path, { name: `completed ${path}`, timeout }),
			hold: service.hold,
			receipt,
			stall: service.stall,
			waitsForAbandoned: (path: string) => service.untilAbandoned((request) => request.path === path, { name: `abandoned ${path}` }),
			watchedReceipt: (name: string) => {
				const watcher = watchers.get(name);
				return watcher ? Fiber.join(watcher) : Effect.die(`No receipt watcher named "${name}".`);
			},
			watchesReceipt: (name: string, path: string) => {
				story.tell(`${name} waits for ${path} to arrive`);
				return receipt(path).pipe(
					Effect.forkChild,
					Effect.tap((watcher) => Effect.sync(() => watchers.set(name, watcher))),
					Effect.asVoid,
				);
			},
		};
	},
});
