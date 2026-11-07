import { Effect } from "effect";
import { fakeHttpService } from "#server/fakeHttpService.ts";
import { routeOutbound } from "#server/routeOutbound.ts";
import { screenDriver } from "#server/screenDriver.ts";
import { storyKit } from "#server/storyKit.ts";
import { background } from "#test/attempt.ts";
import { drivenClock } from "#test/drivenClock.ts";
import { drivenScreen } from "#test/drivenScreen.ts";
import { pendingScreen } from "#test/pendingScreen.ts";

export const screenApp = storyKit({
	clock: "test",
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
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				app.close();
				root.remove();
			}),
		);
		return {
			app,
			clock: yield* drivenClock,
			repaints: async (count: number) => {
				for (let frame = 0; frame < count; frame += 1) {
					const rendered = app.waitFrames(1);
					app.repaint();
					await rendered;
				}
			},
			root,
			service,
		};
	},
	inspect: ({ app, root }) => ({ pending: app.pending(), screen: root.textContent }),
	name: "screen driver",
	stages: ["screen"],
	verbs: ({ clock, app, root, repaints, service }, story) => {
		service.narrate(story.tell);
		const driver = drivenScreen(clock, screenDriver({ pending: app.pending, root, tell: story.tell }));
		const settling = background();
		return {
			...driver,
			holdNews: () =>
				Effect.gen(function* () {
					const hold = yield* service.hold("news");
					yield* Effect.addFinalizer(() => hold.release);
					return hold;
				}),
			narration: () => Effect.sync(() => story.lines),
			output: () => Effect.sync(() => driver.text("output")),
			repaints: (count: number) => Effect.promise(() => repaints(count)),
			screenText: () => Effect.sync(() => driver.text().replace(/\s+/gu, " ")),
			settled: () => settling.finished("settle"),
			settling: () => settling.progress("settle", "still settling"),
			startsSettling: () => settling.starts("settle", driver.settle()),
			withoutPending: screenDriver({ root, tell: story.tell }),
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

export const styledText = screenApp.trait("screen", "a readout has styled blocks and hidden text", ({ root }) => {
	root.insertAdjacentHTML(
		"beforeend",
		'<section id="styled" style="text-transform: uppercase"><p>First</p><p>Second</p><span style="display:none">Hidden</span><svg><text>Icon</text></svg></section>',
	);
});
