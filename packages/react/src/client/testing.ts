import { RegistryContext } from "@effect/atom-react";
import { Clock, Effect, Exit, Scope } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type RootOptions } from "react-dom/client";
import { beforeEach, expect, vi } from "vitest";
import { eventually as retry } from "@shivaedev/test/eventually.ts";
import { withLive } from "@shivaedev/test/withLive.ts";

type CaughtErrorHandler = NonNullable<RootOptions["onCaughtError"]>;

export interface ReactWarningsReadout {
	readonly caughtErrors: readonly unknown[];
	readonly consoleErrors: readonly (readonly unknown[])[];
}

export interface ReactWarnings {
	readonly expectCaughtError: (matches: (error: unknown) => boolean) => CaughtErrorHandler;
	readonly onCaughtError: CaughtErrorHandler;
	readonly read: () => ReactWarningsReadout;
}

const acquireReactWarnings = Effect.acquireRelease(
	Effect.sync(() => {
		const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
		let consoleErrors: readonly (readonly unknown[])[] | undefined;
		const caughtErrors: unknown[] = [];
		const expectations: { caught: boolean }[] = [];
		const capture: ReactWarnings = {
			expectCaughtError: (matches) => {
				const expectation = { caught: false };
				expectations.push(expectation);
				return (error) => {
					if (matches(error)) {
						expectation.caught = true;
					} else {
						caughtErrors.push(error);
					}
				};
			},
			onCaughtError: (error) => {
				caughtErrors.push(error);
			},
			read: () => ({ caughtErrors: [...caughtErrors], consoleErrors: consoleErrors ?? errors.mock.calls.map((args) => [...args]) }),
		};
		return {
			capture,
			expectations,
			restore: () => {
				consoleErrors = capture.read().consoleErrors;
				errors.mockRestore();
			},
		};
	}),
	({ restore }) => Effect.sync(restore),
);

export const captureReactWarnings = Effect.map(acquireReactWarnings, ({ capture }) => capture);

export function expectNoReactWarnings() {
	let current: Effect.Success<typeof acquireReactWarnings>;
	beforeEach(({ onTestFinished }) => {
		const scope = Effect.runSync(Scope.make());
		current = Effect.runSync(Effect.provideService(acquireReactWarnings, Scope.Scope, scope));
		const { capture, expectations } = current;
		onTestFinished(() => {
			Effect.runSync(Scope.close(scope, Exit.void));
			const { consoleErrors, caughtErrors } = capture.read();
			expect(consoleErrors).toEqual([]);
			expect(caughtErrors, "Unexpected caught React errors").toEqual([]);
			expect(
				expectations.every(({ caught }) => caught),
				"Expected caught React error did not occur",
			).toBe(true);
		});
	});
	return {
		expectCaughtError(matches: (error: unknown) => boolean): NonNullable<RootOptions["onCaughtError"]> {
			return current.capture.expectCaughtError(matches);
		},
	};
}
export function eventually(assert: () => void) {
	return withLive(
		Effect.gen(function* () {
			const started = yield* Clock.currentTimeMillis;
			return yield* retry(Effect.try({ catch: (error) => error, try: assert }), {
				timeout: "3 seconds",
				// Responses and React updates must settle together inside act.
				wait: Effect.promise(() =>
					act(async () => {
						await new Promise<void>((resolve) => setTimeout(resolve, 10));
					}),
				),
			}).pipe(
				Effect.catch((error) =>
					Effect.gen(function* () {
						const elapsed = (yield* Clock.currentTimeMillis) - started;
						return yield* Effect.fail(
							new Error(`Assertion did not pass after ${elapsed}ms: ${error instanceof Error ? error.message : String(error)}`, { cause: error }),
						);
					}),
				),
			);
		}),
	);
}
export interface Rendered {
	readonly container: HTMLDivElement;
	readonly registry: AtomRegistry.AtomRegistry;
	readonly render: (node: ReactNode) => Promise<void>;
	readonly unmount: () => Promise<void>;
}
export async function render(node: ReactNode, options?: RootOptions): Promise<Rendered> {
	const registry = AtomRegistry.make();
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container, options);
	let mounted = true;
	async function unmount() {
		if (!mounted) {
			return;
		}
		mounted = false;
		try {
			await act(async () => root.unmount());
		} finally {
			registry.dispose();
			container.remove();
		}
	}
	async function update(next: ReactNode) {
		await act(async () => root.render(createElement(RegistryContext.Provider, { value: registry }, next)));
	}
	try {
		await update(node);
	} catch (error) {
		await unmount();
		throw error;
	}
	return { container, registry, render: update, unmount };
}
