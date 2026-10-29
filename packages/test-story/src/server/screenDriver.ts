import { Data, Effect, Schedule } from "effect";
import { withLive } from "@shivaedev/test/withLive.ts";
import { accessibility, targetName } from "#internal/screenAccessibility.ts";
import { screenElements } from "#internal/screenElements.ts";

export type ScreenTarget = string | { readonly role: string; readonly name: string | RegExp };

export interface ScreenDriverOptions {
	readonly act?: (action: () => Promise<void>) => PromiseLike<void>;
	readonly pending?: () => boolean;
	readonly root: HTMLElement | (() => HTMLElement);
	readonly tell: (line: string) => void;
	readonly timeoutMs?: number;
}

export class MissingScreenPending extends Data.TaggedError("MissingScreenPending") {
	override readonly message =
		"Cannot settle the screen without the pending option.\nhelp: Supply pending: () => boolean that reads the application's pending work and stays true until its resulting screen work is ready to render.";
}

export type ScreenDriver<E = never> = Omit<ReturnType<typeof makeScreenDriver>, "settle"> & {
	settle: (options?: { readonly timeoutMs?: number }) => Effect.Effect<void, E>;
};

export function screenDriver(options: ScreenDriverOptions & { readonly pending: () => boolean }): ScreenDriver;
export function screenDriver(options: ScreenDriverOptions): ScreenDriver<MissingScreenPending>;
export function screenDriver(options: ScreenDriverOptions) {
	return makeScreenDriver(options);
}

function makeScreenDriver({ root, pending, tell, act = (action) => action(), timeoutMs = 3000 }: ScreenDriverOptions) {
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
		const limit = options.timeoutMs ?? timeoutMs;
		const wait = Effect.gen(function* () {
			tell("wait for the screen's pending work");
			do {
				yield* Effect.promise(() => act(async () => undefined));
				if (!pending()) {
					tell("the screen has no pending work");
					return;
				}
				yield* Effect.promise(() => act(() => new Promise<void>((resolve) => setTimeout(resolve, 10))));
			} while (true);
		});
		function timedOut() {
			return Effect.die(
				new Error(
					`The screen did not settle within ${limit}ms.\nhelp: Release held requests and check the app's pending signal and renderer act adapter.\nScreen: ${currentRoot().textContent}`,
				),
			);
		}
		return withLive(wait.pipe(Effect.timeoutOrElse({ duration: limit, orElse: timedOut })));
	}
	function find(target: ScreenTarget, options: { readonly timeout?: number } = {}) {
		return withLive(
			Effect.gen(function* () {
				tell(`find ${targetName(target)}`);
				return yield* Effect.tryPromise(async () => {
					await act(async () => undefined);
					return elements.element(target);
				}).pipe(
					Effect.retry(Schedule.spaced(10)),
					Effect.timeoutOrElse({
						duration: options.timeout ?? timeoutMs,
						orElse: () => Effect.sync(() => elements.element(target)),
					}),
				);
			}),
		);
	}
	return {
		accessible: (selector: string | Element) => {
			if (typeof selector !== "string") {
				return accessibility(selector);
			}
			const element = elements.element(selector);
			const accessible = accessibility(element);
			tell(`read the accessibility of ${selector}: ${JSON.stringify(accessible)}`);
			return accessible;
		},
		click: (selector: ScreenTarget) =>
			perform(`click ${targetName(selector)}`, () => {
				const element = elements.element(selector);
				elements.enabled(element, selector);
				element.focus();
				element.click();
			}),
		enter: (selector: ScreenTarget, value: string) => perform(`enter a value in ${targetName(selector)}`, () => elements.enter(selector, value)),
		find,
		settle,
		submit: (selector: ScreenTarget = "form") => perform(`submit ${targetName(selector)}`, () => elements.form(selector).requestSubmit()),
		text: (selector?: ScreenTarget) => {
			const text = elements.text(selector === undefined ? elements.rendered(currentRoot(), "root") : elements.element(selector));
			tell(`read ${selector === undefined ? "the screen" : targetName(selector)}: ${JSON.stringify(text)}`);
			return text;
		},
		value: (selector: ScreenTarget) => {
			const value = elements.input(selector).value;
			tell(`read the value in ${targetName(selector)}: ${JSON.stringify(value)}`);
			return value;
		},
	};
}
