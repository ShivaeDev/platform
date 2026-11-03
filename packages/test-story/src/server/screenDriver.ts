import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import type * as Stream from "effect/Stream";
import { withLive } from "@shivaedev/test/withLive.ts";
import { screenAct } from "#server/adapters/screenAct.ts";
import { screenElements } from "#server/adapters/screenElements.ts";
import { nextScreenHint } from "#server/internal/nextScreenHint.ts";
import { screenInteractions } from "#server/internal/screenInteractions.ts";
import { screenReadouts } from "#server/internal/screenReadouts.ts";
import { screenWaits } from "#server/internal/screenWaits.ts";
import { targetName } from "#server/internal/targetName.ts";
import type { ScreenSignal } from "#server/screenSignal.ts";
import type { SignalNotReceived } from "#server/until.ts";

export type ScreenTarget = string | { readonly role: string; readonly name: string | RegExp };

export interface ScreenDriverOptions {
	readonly act?: (action: () => Promise<void>) => PromiseLike<void>;
	readonly activity?: ScreenSignal;
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

export class MissingClientActivity extends Data.TaggedError("MissingClientActivity") {
	override readonly message =
		"Cannot wait for a live hint without client activity.\nhelp: Supply activity or pending: a ScreenSignal with current pending work and a hint sequence.";
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

export function screenDriver(
	options: ScreenDriverOptions & ({ readonly pending: ScreenSignal } | { readonly activity: ScreenSignal }),
): ScreenDriver<never, SignalNotReceived>;
export function screenDriver(
	options: ScreenDriverOptions &
		({ readonly pending: (() => boolean) | Stream.Stream<boolean> } | { readonly transport: NonNullable<ScreenDriverOptions["transport"]> }),
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
	const {
		root,
		pending,
		activity,
		transport,
		tell,
		act = (action: () => Promise<void>) => action(),
		timeoutMs = 3000,
		loadingTimeoutMs = 10_000,
	} = options;
	const currentRoot = typeof root === "function" ? root : () => root;
	const elements = screenElements(currentRoot, dialogs);
	const waits = screenWaits({ ...options, act, loadingTimeoutMs, pending, root: currentRoot, timeoutMs }, elements, dialogs);
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
			const signal = activity ?? pending;
			if (signal === undefined || typeof signal === "function" || !("current" in signal)) {
				return Effect.fail(new MissingClientActivity());
			}
			return withLive(Effect.sync(() => tell("wait for the next live hint")).pipe(Effect.andThen(screenAct(act, nextScreenHint(signal)))));
		},
		select: (selector: ScreenTarget, value: string) =>
			perform(`select ${JSON.stringify(value)} in ${targetName(selector)}`, () => elements.select(selector, value)),
		settle: (settings?: { readonly timeoutMs?: number }) =>
			pending === undefined && activity === undefined && transport === undefined ? Effect.fail(new MissingScreenPending()) : waits.settle(settings),
		submit: (selector: ScreenTarget = "form") => perform(`submit ${targetName(selector)}`, () => elements.form(selector).requestSubmit()),
	};
}
