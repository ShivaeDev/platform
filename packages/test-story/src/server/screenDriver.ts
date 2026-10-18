import { Effect } from "effect";
import { withLive } from "@shivaedev/effect-test/withLive.ts";
import { screenElements } from "#internal/screenElements.ts";

export interface ScreenDriverOptions {
	readonly act?: (action: () => Promise<void>) => PromiseLike<void>;
	readonly pending: () => boolean;
	readonly root: HTMLElement | (() => HTMLElement);
	readonly tell: (line: string) => void;
	readonly timeoutMs?: number;
}

export type ScreenDriver = ReturnType<typeof screenDriver>;

export function screenDriver({ root, pending, tell, act = (action) => action(), timeoutMs = 3000 }: ScreenDriverOptions) {
	const currentRoot = typeof root === "function" ? root : () => root;
	const elements = screenElements(currentRoot);
	function perform(line: string, action: () => void) {
		return Effect.promise(async () => {
			tell(line);
			await act(async () => action());
		});
	}
	function settle(options: { readonly timeoutMs?: number } = {}) {
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
	return {
		click: (selector: string) =>
			perform(`click ${selector}`, () => {
				const element = elements.element(selector);
				elements.enabled(element, selector);
				element.focus();
				element.click();
			}),
		enter: (selector: string, value: string) => perform(`enter a value in ${selector}`, () => elements.enter(selector, value)),
		settle,
		submit: (selector = "form") => perform(`submit ${selector}`, () => elements.form(selector).requestSubmit()),
		text: (selector?: string) => {
			const text = (selector === undefined ? currentRoot() : elements.element(selector)).innerText;
			tell(`read ${selector ?? "the screen"}: ${JSON.stringify(text)}`);
			return text;
		},
		value: (selector: string) => {
			const value = elements.input(selector).value;
			tell(`read the value in ${selector}: ${JSON.stringify(value)}`);
			return value;
		},
	};
}
