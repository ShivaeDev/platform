import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import type * as Stream from "effect/Stream";
import { withLive } from "@shivaedev/test/withLive.ts";
import { directScreenAct, type ScreenAct, screenAct, screenPerform } from "#server/adapters/screenAct.ts";
import { screenElements } from "#server/adapters/screenElements.ts";
import type { LiveAnswerSignal } from "#server/LiveAnswerSignal.ts";
import { nextLiveAnswer } from "#server/nextLiveAnswer.ts";
import { screenInteractions } from "#server/screenInteractions.ts";
import { screenReadouts } from "#server/screenReadouts.ts";
import type { ScreenSignal } from "#server/screenSignal.ts";
import { screenWaits } from "#server/screenWaits.ts";
import { targetName } from "#server/targetName.ts";
import type { ScreenClock } from "#server/watchedClock.ts";

export type ScreenTarget = string | { readonly role: string; readonly name: string | RegExp };

export interface ScreenDriverOptions {
	readonly act?: ScreenAct;
	readonly activity?: ScreenSignal;
	readonly clock?: ScreenClock;
	readonly loadingTimeoutMs?: number;
	readonly pending?: (() => boolean) | Stream.Stream<boolean> | ScreenSignal;
	readonly root: HTMLElement | (() => HTMLElement);
	readonly tell: (line: string) => void;
	readonly timeoutMs?: number;
	readonly transport?: ScreenDriverOptions["pending"];
}

export class MissingScreenPending extends Data.TaggedError("MissingScreenPending") {
	override readonly message =
		"Cannot settle the screen without a completion signal.\nhelp: Supply pending, activity or transport that stays busy until the resulting screen work is ready to render.";
}

export type ScreenDriver<E = never> = Omit<ReturnType<typeof makeScreenActions>, "settle"> & {
	settle: (options?: { readonly timeoutMs?: number }) => Effect.Effect<void, E>;
	dialog: (target: ScreenTarget) => ScreenDriver<E>;
	within: (container: ScreenTarget | HTMLElement) => ScreenDriver<E>;
};

export function screenDriver(
	options: ScreenDriverOptions &
		(
			| { readonly pending: NonNullable<ScreenDriverOptions["pending"]> }
			| { readonly activity: ScreenSignal }
			| { readonly transport: NonNullable<ScreenDriverOptions["transport"]> }
		),
): ScreenDriver;
export function screenDriver(options: ScreenDriverOptions): ScreenDriver<MissingScreenPending>;
export function screenDriver(options: ScreenDriverOptions): ScreenDriver<MissingScreenPending> {
	return makeDriver(options, true);
}

function makeDriver(options: ScreenDriverOptions, dialogs: boolean, dialogOwner?: () => HTMLElement): ScreenDriver<MissingScreenPending> {
	const suppliedRoot = options.root;
	const root = typeof suppliedRoot === "function" ? suppliedRoot : () => suppliedRoot;
	const elements = screenElements(root, dialogs);
	const owner = dialogOwner ?? root;
	const dialogElements = screenElements(owner);
	return {
		...makeScreenActions(options, dialogs),
		dialog: (target) => {
			function dialogRoot() {
				return dialogElements.dialog(target);
			}
			dialogRoot();
			return makeDriver({ ...options, root: dialogRoot }, false, owner);
		},
		within: (container) => {
			function scopedRoot() {
				return container instanceof HTMLElement ? elements.rendered(container, container.tagName.toLowerCase()) : elements.element(container);
			}
			scopedRoot();
			return makeDriver({ ...options, root: scopedRoot }, false, owner);
		},
	};
}

function makeScreenActions(options: ScreenDriverOptions, dialogs: boolean) {
	const { root, pending, activity, transport, tell, act = directScreenAct, timeoutMs = 3000, loadingTimeoutMs = 10_000 } = options;
	const currentRoot = typeof root === "function" ? root : () => root;
	const elements = screenElements(currentRoot, dialogs);
	const waits = screenWaits({ ...options, act, loadingTimeoutMs, pending, root: currentRoot, timeoutMs }, elements, dialogs);
	const perform = screenPerform(act, tell);

	return {
		...screenReadouts(currentRoot, tell, dialogs),
		...screenInteractions(elements, perform),
		...waits,
		click: (selector: ScreenTarget) =>
			perform(`click ${targetName(selector)}`, () => {
				const element = elements.element(selector);
				elements.enabled(element, selector);
				element.focus();
				element.click();
			}),
		enter: (selector: ScreenTarget, value: string) => perform(`enter a value in ${targetName(selector)}`, () => elements.enter(selector, value)),
		select: (selector: ScreenTarget, value: string) =>
			perform(`select ${JSON.stringify(value)} in ${targetName(selector)}`, () => elements.select(selector, value)),
		settle: (settings?: { readonly timeoutMs?: number }) =>
			pending === undefined && activity === undefined && transport === undefined ? Effect.fail(new MissingScreenPending()) : waits.settle(settings),
		submit: (selector: ScreenTarget = "form") => perform(`submit ${targetName(selector)}`, () => elements.form(selector).requestSubmit()),
		withLiveAnswer: <A, E, R>(answers: LiveAnswerSignal, action: Effect.Effect<A, E, R>, settings: { readonly timeoutMs?: number } = {}) =>
			Effect.gen(function* () {
				const before = yield* answers.current;
				const result = yield* action;
				tell(`wait for a live answer to ${answers.name}`);
				yield* withLive(screenAct(act, nextLiveAnswer(answers, before, settings.timeoutMs ?? timeoutMs)));
				return result;
			}),
	};
}
