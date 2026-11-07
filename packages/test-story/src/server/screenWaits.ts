import * as Effect from "effect/Effect";
import { withLive } from "@shivaedev/test/withLive.ts";
import type { screenElements } from "#server/adapters/screenElements.ts";
import { screenLoading } from "#server/adapters/screenLoading.ts";
import { screenNavigation } from "#server/adapters/screenNavigation.ts";
import { loadingDeadline } from "#server/loadingDeadline.ts";
import type { ScreenDriverOptions, ScreenTarget } from "#server/screenDriver.ts";
import { targetName } from "#server/targetName.ts";
import { waitForScreen } from "#server/waitForScreen.ts";

type Options = Omit<ScreenDriverOptions, "act" | "root" | "timeoutMs" | "pending"> & {
	readonly act: NonNullable<ScreenDriverOptions["act"]>;
	readonly pending: ScreenDriverOptions["pending"];
	readonly root: () => HTMLElement;
	readonly timeoutMs: number;
};

export function screenWaits(options: Options, elements: ReturnType<typeof screenElements>, dialogs: boolean) {
	const { act, pending, root, tell, timeoutMs } = options;
	const supplied = pending !== undefined || options.activity !== undefined || options.transport !== undefined;
	const loading = screenLoading(root, dialogs);
	function unsettled(limit: number) {
		return new Error(
			`The screen did not settle within ${limit}ms.\nhelp: Release held requests and check the app's pending signal and renderer act adapter.\nScreen: ${root().textContent}`,
		);
	}
	function wait<A>(line: string, read: () => A, timeout: number | undefined, expired: () => Effect.Effect<A>) {
		const limit = timeout ?? timeoutMs;
		return withLive(
			Effect.sync(() => tell(line)).pipe(
				Effect.andThen(
					Effect.raceFirst(
						waitForScreen({ ...options, act, pending, root }, Effect.try(read)),
						loadingDeadline(root, loading, limit, timeout === undefined ? (options.loadingTimeoutMs ?? 10_000) : limit, expired),
					),
				),
			),
		);
	}
	return {
		find: (target: ScreenTarget, settings: { readonly timeout?: number } = {}) => {
			const limit = settings.timeout ?? timeoutMs;
			return wait(
				`find ${targetName(target)}`,
				() => elements.element(target),
				settings.timeout,
				() => {
					const lookup = Effect.sync(() => elements.element(target));
					return supplied ? lookup.pipe(Effect.andThen(Effect.die(unsettled(limit)))) : lookup;
				},
			);
		},
		findText: (text: string | RegExp, settings: { readonly timeout?: number } = {}) => {
			const name = typeof text === "string" ? JSON.stringify(text) : String(text);
			const limit = settings.timeout ?? timeoutMs;
			return wait(
				`find text ${name}`,
				() => elements.textElement(text),
				settings.timeout,
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
							{ ...options, act, pending, root },
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
					Effect.andThen(waitForScreen({ ...options, act, pending, root }, Effect.void)),
					Effect.tap(() => Effect.sync(() => tell("the screen has no pending work"))),
					Effect.timeoutOrElse({ duration: limit, orElse: () => Effect.die(unsettled(limit)) }),
				),
			);
		},
	};
}
