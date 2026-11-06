import { randomUUID } from "node:crypto";
import { NodeServices } from "@effect/platform-node";
import { Config, Effect, Layer, Stream } from "effect";
import { chromium } from "playwright";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { pageAdapter } from "#adapters/page.ts";
import { playwright } from "#adapters/playwright.ts";
import { Browser } from "#Browser.ts";

export const liveSocket = storyKit({
	clock: "test",
	*create() {
		const url = yield* Config.String("BROWSER_CHECK_URL");
		const email = yield* Config.String("BROWSER_CHECK_EMAIL");
		const password = yield* Config.String("BROWSER_CHECK_PASSWORD");
		const session = yield* (yield* Browser).open;
		yield* session.signIn(new URL("/api/auth/sign-in/email", url).href, email, password);
		const page = yield* session.newPage;
		const socketUrl = new URL("/rpc", url);
		socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
		const socket = yield* page.watchSocket(socketUrl.href);
		const messages = Stream.fromEffectRepeat(socket.nextMessage).pipe(
			Stream.map((frame) => (typeof frame === "string" ? frame : new TextDecoder().decode(frame))),
		);
		const writer = yield* Effect.acquireRelease(
			Effect.promise(() => chromium.launch({ executablePath: chromium.executablePath() })),
			(browser) => Effect.promise(() => browser.close()),
		);
		const context = yield* Effect.promise(() => writer.newContext());
		yield* Effect.promise(async () => {
			const response = await context.request.post(new URL("/api/auth/sign-in/email", url).href, {
				data: { email, password },
				headers: { origin: new URL(url).origin },
			});
			if (!response.ok()) {
				throw new Error(`Starter writer sign-in returned HTTP ${response.status()}.`);
			}
		});
		const writerPage = yield* Effect.promise(() => context.newPage());
		writerPage.setDefaultTimeout(5000);
		yield* Effect.promise(() => writerPage.goto(url));
		return { messages, page, url, writerPage };
	},
	inspect: ({ url }) => ({ url }),
	layer: playwright.pipe(Layer.provideMerge(NodeServices.layer)),
	name: "starter live socket",
	stages: [],
	verbs: ({ messages, page, url, writerPage }, story) => ({
		addsNote: (title: string) => {
			story.tell(`another browser adds the note ${JSON.stringify(title)}`);
			return Effect.promise(async () => {
				await writerPage.getByLabel("New note", { exact: true }).fill(title);
				await writerPage.getByRole("button", { exact: true, name: "Add note" }).click();
			}).pipe(Effect.andThen(pageAdapter(writerPage).checkText(`Added ${title}`)));
		},
		checksText: (text: string) => page.checkText(text),
		freshTitle: () => Effect.sync(() => `Live browser note ${randomUUID()}`),
		nextChange: () => until(messages, (frame) => frame.includes('"_tag":"Changed"'), { name: "the notes change hint" }),
		nextList: () =>
			until(messages, (frame) => frame.includes('"_tag":"Result"') && frame.includes('"query":"list"'), { name: "the live notes result" }),
		visits: () => {
			story.tell("the observed browser visits the starter with its socket observer already installed");
			return page.visit(url);
		},
	}),
});
