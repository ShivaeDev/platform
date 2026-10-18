import { Effect, Exit, Scope } from "effect";
import { afterAll, beforeAll } from "vitest";
import { fakeHttpService } from "#fakeHttpService.ts";
import { screenDriver } from "#screenDriver.ts";
import { storyKit } from "#storyKit.ts";
import { pendingScreen } from "./pendingScreen.ts";

const outbound: Record<string, string> = {};
let scope: Scope.Closeable;
let service: Effect.Success<ReturnType<typeof fakeHttpService>>;
beforeAll(async () => {
	scope = await Effect.runPromise(Scope.make());
	service = await Effect.runPromise(
		fakeHttpService({
			routes: {
				news: { path: "/news", reply: () => ({ body: "Today's news" }) },
				session: {
					method: "POST",
					path: "/session",
					reply: ({ body }) => ({ body: `Signed in as ${new URLSearchParams(body.toString()).get("email")}` }),
				},
			},
		}).pipe(Effect.provideService(Scope.Scope, scope)),
	);
	outbound["identity.test"] = service.url;
});
afterAll(async () => Effect.runPromise(Scope.close(scope, Exit.void)));

export const screenApp = storyKit({
	clock: "live",
	*create() {
		const root = document.createElement("main");
		document.body.append(root);
		const app = pendingScreen(root);
		let repainting: ReturnType<typeof setInterval> | undefined;
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				clearInterval(repainting);
				app.close();
				root.remove();
			}),
		);
		return {
			app,
			repaints: (count: number) => {
				const frames = app.waitFrames(count);
				repainting ??= setInterval(app.repaint, 10);
				return frames;
			},
			root,
		};
	},
	inspect: ({ app, root }) => ({ pending: app.pending(), screen: root.textContent }),
	name: "screen driver",
	outbound,
	stages: ["screen"],
	verbs: ({ app, root, repaints }, story) => {
		service.narrate(story.tell);
		return {
			...screenDriver({ pending: app.pending, root, tell: story.tell }),
			holdNews: () =>
				Effect.gen(function* () {
					const hold = yield* service.hold("news");
					yield* Effect.addFinalizer(() => hold.release);
					return hold;
				}),
			repaints: (count: number) => Effect.promise(() => repaints(count)),
			shortSettle: () => screenDriver({ pending: app.pending, root, tell: story.tell, timeoutMs: 40 }).settle(),
		};
	},
});
