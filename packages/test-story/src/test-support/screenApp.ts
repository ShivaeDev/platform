import { Effect } from "effect";
import { fakeHttpService } from "#fakeHttpService.ts";
import { routeOutbound } from "#routeOutbound.ts";
import { screenDriver } from "#screenDriver.ts";
import { storyKit } from "#storyKit.ts";
import { pendingScreen } from "./pendingScreen.ts";

export const screenApp = storyKit({
	clock: "live",
	*create() {
		const service = yield* fakeHttpService({
			routes: {
				news: { path: "/news", reply: () => ({ body: "Today's news" }) },
				session: {
					method: "POST",
					path: "/session",
					reply: ({ body }) => ({ body: `Signed in as ${new URLSearchParams(body.toString()).get("email")}` }),
				},
			},
		});
		yield* routeOutbound({ "identity.test": service.url });
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
			service,
		};
	},
	inspect: ({ app, root }) => ({ pending: app.pending(), screen: root.textContent }),
	name: "screen driver",
	stages: ["screen"],
	verbs: ({ app, root, repaints, service }, story) => {
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
		};
	},
});

export function hiddenScreen(style: string, ancestor: boolean) {
	return screenApp.trait("screen", `the ${ancestor ? "screen ancestor" : "targets"} have ${style}`, ({ root }) => {
		const targets = ancestor ? [root] : root.querySelectorAll<HTMLElement>("button,input,textarea,form,output");
		for (const target of targets) {
			if (style === "hidden") {
				target.hidden = true;
			} else {
				target.style.cssText = style;
			}
		}
	});
}

export const inertForm = screenApp.trait("screen", "the sign-in form has an inert ancestor", ({ root }) => {
	root.inert = true;
});

export const labelledControl = screenApp.trait("screen", "a control has a visible label and a conflicting aria-label", ({ root }) => {
	root.insertAdjacentHTML(
		"beforeend",
		'<span id="delivery-label">Email notifications</span><button id="delivery" role="switch" aria-labelledby="delivery-label" aria-label="Off" aria-checked="false">Off</button>',
	);
});
