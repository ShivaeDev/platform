import { Effect } from "effect";
import type { RootOptions } from "react-dom/client";
import { vi } from "vitest";
import { expectNoReactWarnings, type Rendered, render } from "#client/adapters/react.ts";
import { storyKit } from "#server/storyKit.ts";
import { BrokenScreen, FailureBoundary } from "./failureBoundary.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
const warnings = expectNoReactWarnings();
export class ScreenFailure extends Error {}

export const guardScreen = storyKit({
	clock: "test",
	create: (): { roots: Rendered[] } => ({ roots: [] }),
	inspect: ({ roots }) => roots.map(({ container }) => container.innerHTML),
	name: "React warning guard",
	stages: ["screen"],
	verbs: (state, story) => ({
		alert: () => Effect.sync(() => state.roots.at(-1)?.container.querySelector('[role="alert"]')?.textContent ?? "no alert"),
		expectCaughtError: warnings.expectCaughtError,
		heading: () => Effect.sync(() => state.roots.at(-1)?.container.querySelector("h1")?.textContent ?? "no heading"),
		logError: (message: string) =>
			Effect.sync(() => {
				story.tell(`log ${message}`);
				vi.mocked(console.error)(message);
			}),
		openScreen: (failure: Error | null, options?: RootOptions, warning = false) =>
			Effect.acquireRelease(
				Effect.promise(async () => {
					story.tell(failure === null ? "open a screen without a failure" : `open a screen that throws ${failure.name}: ${failure.message}`);
					const view = await render(
						<FailureBoundary warning={warning}>{failure ? <BrokenScreen failure={failure} /> : <h1>Screen ready</h1>}</FailureBoundary>,
						options,
					);
					state.roots.push(view);
					return view;
				}),
				(view) => Effect.promise(view.unmount),
			).pipe(Effect.asVoid),
	}),
});
