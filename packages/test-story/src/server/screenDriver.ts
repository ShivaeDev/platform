import { Data, Effect, type Stream } from "effect";
import type { ClientActivity } from "@shivaedev/contract/clientActivity.ts";
import { withLive } from "@shivaedev/test/withLive.ts";
import { nextClientHint } from "#internal/nextClientHint.ts";
import { targetName } from "#internal/screenAccessibility.ts";
import { screenElements } from "#internal/screenElements.ts";
import { screenReadouts } from "#internal/screenReadouts.ts";
import { waitForScreen } from "#internal/waitForScreen.ts";

export type ScreenTarget = string | { readonly role: string; readonly name: string | RegExp };

export interface ScreenDriverOptions {
	readonly act?: (action: () => Promise<void>) => PromiseLike<void>;
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
	const suppliedRoot = options.root;
	const root = typeof suppliedRoot === "function" ? suppliedRoot : () => suppliedRoot;
	const elements = screenElements(root);
	return {
		...makeScreenActions(options),
		within: (container) => {
			function scopedRoot() {
				return container instanceof HTMLElement ? elements.rendered(container, container.tagName.toLowerCase()) : elements.element(container);
			}
			scopedRoot();
			return screenDriver({ ...options, root: scopedRoot });
		},
	};
}

function makeScreenActions({ root, pending, tell, act = (action) => action(), timeoutMs = 3000 }: ScreenDriverOptions) {
	const currentRoot = typeof root === "function" ? root : () => root;
	const elements = screenElements(currentRoot);
	function perform(line: string, action: () => void) {
		return Effect.promise(async () => {
			tell(line);
			await act(async () => action());
		});
	}
	function settle(options: { readonly timeoutMs?: number } = {}) {
		if (pending === undefined) {
			return Effect.fail(new MissingScreenPending());
		}
		return settleWork(pending, options);
	}
	function settleWork(work: NonNullable<ScreenDriverOptions["pending"]>, options: { readonly timeoutMs?: number }) {
		const limit = options.timeoutMs ?? timeoutMs;
		const wait = Effect.gen(function* () {
			tell("wait for the screen's pending work");
			yield* waitForScreen({ act, pending: work, root: currentRoot }, Effect.void);
			tell("the screen has no pending work");
		});
		return withLive(wait.pipe(Effect.timeoutOrElse({ duration: limit, orElse: () => Effect.die(unsettled(limit)) })));
	}
	function unsettled(limit: number) {
		return new Error(
			`The screen did not settle within ${limit}ms.\nhelp: Release held requests and check the app's pending signal and renderer act adapter.\nScreen: ${currentRoot().textContent}`,
		);
	}
	function find(target: ScreenTarget, options: { readonly timeout?: number } = {}) {
		const limit = options.timeout ?? timeoutMs;
		function timedOut() {
			const lookup = Effect.sync(() => elements.element(target));
			return pending === undefined ? lookup : lookup.pipe(Effect.andThen(Effect.die(unsettled(limit))));
		}
		return withLive(
			Effect.sync(() => tell(`find ${targetName(target)}`)).pipe(
				Effect.andThen(
					waitForScreen(
						{ act, pending, root: currentRoot },
						Effect.try(() => elements.element(target)),
					),
				),
				Effect.timeoutOrElse({
					duration: limit,
					orElse: timedOut,
				}),
			),
		);
	}
	return {
		...screenReadouts(currentRoot, tell),
		click: (selector: ScreenTarget) =>
			perform(`click ${targetName(selector)}`, () => {
				const element = elements.element(selector);
				elements.enabled(element, selector);
				element.focus();
				element.click();
			}),
		enter: (selector: ScreenTarget, value: string) => perform(`enter a value in ${targetName(selector)}`, () => elements.enter(selector, value)),
		find,
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
		settle,
		submit: (selector: ScreenTarget = "form") => perform(`submit ${targetName(selector)}`, () => elements.form(selector).requestSubmit()),
	};
}
