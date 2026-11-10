import { Deferred, Effect, Fiber, Queue, Stream, SubscriptionRef } from "effect";
import { act } from "react";
import { activityScreenSignal, clientActivity, isClientIdle } from "@shivaedev/contract/clientActivity.ts";
import { liveAnswers } from "@shivaedev/contract/liveAnswers.ts";
import { expectNoReactWarnings } from "#client/adapters/react.ts";
import { domPage } from "#server/domPage.ts";
import { fakeHttpService } from "#server/fakeHttpService.ts";
import { mountApp } from "#server/mountApp.ts";
import { screenDriver } from "#server/screenDriver.ts";
import { storyKit } from "#server/storyKit.ts";
import { until } from "#server/until.ts";
import { createSettlingApp } from "#test/createSettlingApp.ts";
import { readPageHost } from "#test/readPageHost.ts";
import { SettlingApp } from "#test/SettlingApp.tsx";
import { settlingSignals } from "#test/settlingSignals.ts";

expectNoReactWarnings();

const settlementState = Effect.fnUntraced(function* (
	fiber: Fiber.Fiber<void>,
	observations: Effect.Success<ReturnType<typeof settlingSignals>>["observations"],
	last: "pending work" | "client activity" | "transport",
) {
	yield* until(Stream.fromQueue(observations), (state) => Object.entries(state).every(([name, busy]) => name === last || !busy), {
		name: "the driver observes the other work finish",
	});
	yield* Effect.yieldNow;
	return fiber.pollUnsafe() === undefined ? "waiting" : "settled";
});

export const settlingPage = storyKit({
	clock: "test",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const host = yield* readPageHost;
		const files = yield* fakeHttpService({
			routes: {
				attachment: { path: "/attachment", reply: () => ({ body: Buffer.from("Attached notes"), headers: { "content-type": "text/plain" } }) },
			},
		});
		const transport = yield* domPage(files.url);
		const view = yield* mountApp({ create: createSettlingApp(host.url), render: (app) => <SettlingApp app={app} /> });
		const raw = yield* view.app.client.client;
		return { files, host, raw, transport, view };
	},
	inspect: ({ view }) => view.container.textContent,
	name: "combined screen completion",
	stages: ["host"],
	verbs: ({ files, host, raw, transport, view }, story) => {
		const { app } = view;
		const activity = activityScreenSignal(clientActivity(app.client), isClientIdle);
		const screen = screenDriver({
			act,
			activity,
			pending: SubscriptionRef.changes(app.pending),
			root: view.container,
			tell: story.tell,
			transport: transport.pending,
		});
		return {
			...screen,
			attachment: () => Effect.sync(() => screen.text("[data-attachment]")),
			drafts: () => Effect.sync(() => [...document.querySelectorAll("input")].map((input) => input.value)),
			finishPreview: () => Deferred.succeed(app.preview, undefined).pipe(Effect.andThen(Deferred.await(app.previewed))),
			preview: () => Effect.sync(() => screen.text("[data-preview]")),
			save: (settings?: { readonly timeoutMs?: number }) =>
				screen.withLiveAnswer(
					liveAnswers(view.registry, "page 1", app.client.api.get.query({ id: 1 })),
					screen.click({ name: "Save", role: "button" }),
					settings,
				),
			startAttachment: (prepare = false) =>
				Effect.gen(function* () {
					const hold = yield* files.hold("attachment");
					yield* screen.click({ name: prepare ? "Load attachment and prepare preview" : "Load attachment", role: "button" });
					yield* hold.waiting;
					return hold.release.pipe(Effect.andThen(Deferred.await(app.attached)));
				}),
			startPreview: () => screen.click({ name: "Prepare preview", role: "button" }),
			startRead: () =>
				Effect.gen(function* () {
					host.holdRead();
					const read = yield* raw["page.get"]({ id: 1 }).pipe(Effect.forkScoped({ startImmediately: true }));
					yield* Queue.take(host.reading);
					return Effect.sync(host.releaseRead).pipe(Effect.andThen(Fiber.join(read)), Effect.asVoid);
				}),
			startSettling: () =>
				Effect.gen(function* () {
					const signals = yield* settlingSignals(app.pending, activity, transport.pending);
					const driver = screenDriver({
						act,
						activity: signals.activity,
						pending: signals.pending,
						root: view.container,
						tell: story.tell,
						transport: signals.transport,
					});
					const fiber = yield* driver.settle().pipe(Effect.forkScoped({ startImmediately: true }));
					yield* Queue.take(signals.observations);
					return {
						finish: Fiber.join(fiber),
						state: (last: "pending work" | "client activity" | "transport") => settlementState(fiber, signals.observations, last),
					};
				}),
		};
	},
});

export const rerunsAfterReceipt = settlingPage.trait(
	"host",
	"the server reruns a changed page only after the client has the save's receipt",
	function* ({ host, view }) {
		host.holdReruns();
		const receipt = until(clientActivity(view.app.client), (state) => state.commands === 0, { name: "the save's receipt on the client" });
		yield* Queue.take(host.rerunHeld).pipe(
			Effect.andThen(receipt),
			Effect.andThen(Effect.sync(host.releaseReruns)),
			Effect.forever,
			Effect.forkScoped,
		);
	},
);

export const savesPublishNoChange = settlingPage.trait("host", "the server publishes no change when a page is saved", ({ host }) =>
	host.publishNoWrites(),
);
