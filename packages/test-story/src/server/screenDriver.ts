import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import type * as Stream from "effect/Stream";
import type { ClientActivity } from "@shivaedev/contract/clientActivity.ts";
import { withLive } from "@shivaedev/test/withLive.ts";
import { screenAct } from "#server/adapters/screenAct.ts";
import { screenElements } from "#server/adapters/screenElements.ts";
import { nextClientHint } from "#server/internal/nextClientHint.ts";
import { targetName } from "#server/internal/screenAccessibility.ts";
import { screenInteractions } from "#server/internal/screenInteractions.ts";
import { screenReadouts } from "#server/internal/screenReadouts.ts";
import { screenWaits } from "#server/internal/screenWaits.ts";
import type { SignalNotReceived } from "#server/until.ts";

export type ScreenTarget = string | { readonly role: string; readonly name: string | RegExp };

export interface ScreenDriverOptions {
	readonly act?: (action: () => Promise<void>) => PromiseLike<void>;
	readonly loadingTimeoutMs?: number;
	readonly pending?: (() => boolean) | Stream.Stream<boolean> | ClientActivity;
	readonly root: HTMLElement | (() => HTMLElement);
	readonly tell: (line: string) => void;
	readonly timeoutMs?: number;
}

export class MissingScreenPending extends Data.TaggedError("MissingScreenPending") {
	override readonly message =
		"Cannot settle the screen without the pending option.\nhelp: Supply pending: () => boolean that reads the application's pending work and stays true until its resulting screen work is ready to render.";
}

export class MissingClientActivity extends Data.TaggedError("MissingClientActivity") {
	override readonly message =
		"Cannot wait for a live hint without client activity.\nhelp: Supply pending: clientActivity(client) from @shivaedev/contract/clientActivity.ts.";
}

export type ScreenDriver<E = never, THintError = MissingClientActivity | SignalNotReceived> = Omit<
	ReturnType<typeof makeScreenActions>,
	"settle" | "nextLiveHint"
> & {
	nextLiveHint: () => Effect.Effect<void, THintError>;
	settle: (options?: { readonly timeoutMs?: number }) => Effect.Effect<void, E>;
	dialog: (target: ScreenTarget) => ScreenDriver<E, THintError>;
	within: (container: ScreenTarget | HTMLElement) => ScreenDriver<E, THintError>;
};

export function screenDriver(options: ScreenDriverOptions & { readonly pending: ClientActivity }): ScreenDriver<never, SignalNotReceived>;
export function screenDriver(options: ScreenDriverOptions & { readonly pending: (() => boolean) | Stream.Stream<boolean> }): ScreenDriver;
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

function makeScreenActions(
	{ root, pending, tell, act = (action) => action(), timeoutMs = 3000, loadingTimeoutMs = 10_000 }: ScreenDriverOptions,
	dialogs: boolean,
) {
	const currentRoot = typeof root === "function" ? root : () => root;
	const elements = screenElements(currentRoot, dialogs);
	const waits = screenWaits({ act, loadingTimeoutMs, pending, root: currentRoot, tell, timeoutMs }, elements, dialogs);
	function perform(line: string, action: () => void) {
		return Effect.promise(async () => {
			tell(line);
			await act(async () => action());
		});
	}

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
		nextLiveHint: () => {
			if (pending === undefined || typeof pending === "function" || !("current" in pending)) {
				return Effect.fail(new MissingClientActivity());
			}
			return withLive(Effect.sync(() => tell("wait for the next live hint")).pipe(Effect.andThen(screenAct(act, nextClientHint(pending)))));
		},
		select: (selector: ScreenTarget, value: string) =>
			perform(`select ${JSON.stringify(value)} in ${targetName(selector)}`, () => elements.select(selector, value)),
		settle: (settings?: { readonly timeoutMs?: number }) =>
			pending === undefined ? Effect.fail(new MissingScreenPending()) : waits.settle(settings),
		submit: (selector: ScreenTarget = "form") => perform(`submit ${targetName(selector)}`, () => elements.form(selector).requestSubmit()),
	};
}
