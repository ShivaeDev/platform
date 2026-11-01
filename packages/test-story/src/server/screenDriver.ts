import { Data, Effect, type Stream } from "effect";
import type { ClientActivity } from "@shivaedev/contract/clientActivity.ts";
import { withLive } from "@shivaedev/test/withLive.ts";
import { screenElements } from "#adapters/screenElements.ts";
import { nextClientHint } from "#internal/nextClientHint.ts";
import { targetName } from "#internal/screenAccessibility.ts";
import { screenReadouts } from "#internal/screenReadouts.ts";
import { screenWaits } from "#internal/screenWaits.ts";

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

export type ScreenDriver<E = never, THintError = MissingClientActivity> = Omit<ReturnType<typeof makeScreenActions>, "settle" | "nextLiveHint"> & {
	nextLiveHint: () => Effect.Effect<void, THintError>;
	settle: (options?: { readonly timeoutMs?: number }) => Effect.Effect<void, E>;
	within: (container: ScreenTarget | HTMLElement) => ScreenDriver<E, THintError>;
};

export function screenDriver(options: ScreenDriverOptions & { readonly pending: ClientActivity }): ScreenDriver<never, never>;
export function screenDriver(options: ScreenDriverOptions & { readonly pending: (() => boolean) | Stream.Stream<boolean> }): ScreenDriver;
export function screenDriver(options: ScreenDriverOptions): ScreenDriver<MissingScreenPending>;
export function screenDriver(options: ScreenDriverOptions): ScreenDriver<MissingScreenPending> {
	return makeDriver(options, true);
}

function makeDriver(options: ScreenDriverOptions, dialogs: boolean): ScreenDriver<MissingScreenPending> {
	const suppliedRoot = options.root;
	const root = typeof suppliedRoot === "function" ? suppliedRoot : () => suppliedRoot;
	const elements = screenElements(root, dialogs);
	return {
		...makeScreenActions(options, dialogs),
		within: (container) => {
			function scopedRoot() {
				return container instanceof HTMLElement ? elements.rendered(container, container.tagName.toLowerCase()) : elements.element(container);
			}
			scopedRoot();
			return makeDriver({ ...options, root: scopedRoot }, false);
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
			return withLive(
				Effect.sync(() => tell("wait for the next live hint")).pipe(
					Effect.andThen(Effect.promise((signal) => act(() => Effect.runPromise(nextClientHint(pending), { signal })))),
				),
			);
		},
		select: (selector: ScreenTarget, value: string) =>
			perform(`select ${JSON.stringify(value)} in ${targetName(selector)}`, () => elements.select(selector, value)),
		settle: (settings?: { readonly timeoutMs?: number }) =>
			pending === undefined ? Effect.fail(new MissingScreenPending()) : waits.settle(settings),
		submit: (selector: ScreenTarget = "form") => perform(`submit ${targetName(selector)}`, () => elements.form(selector).requestSubmit()),
	};
}
