import { Effect } from "effect";
import { withLive } from "@shivaedev/test/withLive.ts";
import type { screenElements } from "#adapters/screenElements.ts";
import { screenNavigation } from "#adapters/screenNavigation.ts";
import type { ScreenDriverOptions, ScreenTarget } from "#screenDriver.ts";
import { targetName } from "./screenAccessibility.ts";
import { waitForScreen } from "./waitForScreen.ts";

type Options = Omit<ScreenDriverOptions, "act" | "root" | "timeoutMs" | "pending"> & {
	readonly act: NonNullable<ScreenDriverOptions["act"]>;
	readonly pending: ScreenDriverOptions["pending"];
	readonly root: () => HTMLElement;
	readonly timeoutMs: number;
};

export function screenWaits(options: Options, elements: ReturnType<typeof screenElements>) {
	const { act, pending, root, tell, timeoutMs } = options;
	function unsettled(limit: number) {
		return new Error(
			`The screen did not settle within ${limit}ms.\nhelp: Release held requests and check the app's pending signal and renderer act adapter.\nScreen: ${root().textContent}`,
		);
	}
	function wait<A>(line: string, read: () => A, timeout: number, expired: () => Effect.Effect<A>) {
		return withLive(
			Effect.sync(() => tell(line)).pipe(
				Effect.andThen(waitForScreen({ act, pending, root }, Effect.try(read))),
				Effect.timeoutOrElse({ duration: timeout, orElse: expired }),
			),
		);
	}
	return {
		find: (target: ScreenTarget, settings: { readonly timeout?: number } = {}) => {
			const limit = settings.timeout ?? timeoutMs;
			return wait(
				`find ${targetName(target)}`,
				() => elements.element(target),
				limit,
				() => {
					const lookup = Effect.sync(() => elements.element(target));
					return pending === undefined ? lookup : lookup.pipe(Effect.andThen(Effect.die(unsettled(limit))));
				},
			);
		},
		findText: (text: string | RegExp, settings: { readonly timeout?: number } = {}) => {
			const name = typeof text === "string" ? JSON.stringify(text) : String(text);
			const limit = settings.timeout ?? timeoutMs;
			return wait(
				`find text ${name}`,
				() => elements.textElement(text),
				limit,
				() =>
					Effect.sync(() => elements.textElement(text)).pipe(
						Effect.andThen(
							Effect.die(new Error(`The screen did not finish waiting for text ${name} within ${limit}ms.\nhelp: Check the app's pending signal.`)),
						),
					),
			);
		},
		gone: (target: ScreenTarget, settings: { readonly timeout?: number } = {}) => {
			const limit = settings.timeout ?? timeoutMs;
			function stillHere() {
				return new Error(
					`The screen did not lose ${targetName(target)} within ${limit}ms.\nhelp: Remove or hide every matching target and complete pending work.`,
				);
			}
			return withLive(
				Effect.sync(() => tell(`wait for ${targetName(target)} to disappear`)).pipe(
					Effect.andThen(
						waitForScreen(
							{ act, pending, root },
							Effect.suspend(() => (elements.matches(target).length === 0 ? Effect.void : Effect.fail(stillHere()))),
						),
					),
					Effect.timeoutOrElse({ duration: limit, orElse: () => Effect.die(stillHere()) }),
				),
			);
		},
		navigatedAway: (prefix: string, settings: { readonly timeout?: number } = {}) => {
			const limit = settings.timeout ?? timeoutMs;
			function timedOut() {
				return Effect.die(
					new Error(
						`The screen did not navigate to ${JSON.stringify(prefix)} within ${limit}ms.\nhelp: Trigger the redirect and check its destination.\nLocation: ${root().ownerDocument.location.href}`,
					),
				);
			}
			return withLive(
				Effect.sync(() => tell(`wait for navigation to ${JSON.stringify(prefix)}`)).pipe(
					Effect.andThen(screenNavigation(root, prefix)),
					Effect.timeoutOrElse({ duration: limit, orElse: timedOut }),
				),
			);
		},
		settle: (settings: { readonly timeoutMs?: number } = {}) => {
			const limit = settings.timeoutMs ?? timeoutMs;
			return withLive(
				Effect.sync(() => tell("wait for the screen's pending work")).pipe(
					Effect.andThen(waitForScreen({ act, pending, root }, Effect.void)),
					Effect.tap(() => Effect.sync(() => tell("the screen has no pending work"))),
					Effect.timeoutOrElse({ duration: limit, orElse: () => Effect.die(unsettled(limit)) }),
				),
			);
		},
	};
}
