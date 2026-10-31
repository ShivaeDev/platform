import { CatchBoundary } from "@tanstack/react-router";
import { Effect } from "effect";
import type { ReactNode } from "react";
import type { RootOptions } from "react-dom/client";
import { captureReactWarnings, type Rendered, render } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { BrokenScreen } from "./BrokenScreen.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

export const warningScreen = storyKit({
	clock: "live",
	create: () => captureReactWarnings,
	inspect: (warnings) => warnings.read(),
	name: "React warning screen",
	stages: ["screen"],
	verbs: (warnings, story) => {
		const roots: Rendered[] = [];
		function open(line: string, node: ReactNode, options?: RootOptions) {
			story.tell(line);
			return Effect.acquireRelease(
				Effect.promise(async () => {
					const view = await render(node, options);
					roots.push(view);
					return view;
				}),
				(view) => Effect.promise(view.unmount),
			).pipe(Effect.asVoid);
		}
		function screen() {
			const view = roots.at(-1);
			if (view === undefined) {
				throw new Error("No screen is open");
			}
			return view.container;
		}
		return {
			alert: () => Effect.sync(() => screen().querySelector('[role="alert"]')?.textContent ?? "no alert"),
			expectCaughtError: warnings.expectCaughtError,
			field: () => Effect.sync(() => screen().querySelector("input")?.value ?? "no field"),
			openCleanScreen: () => open("render a screen without warnings", <h1>Screen ready</h1>),
			openFailedScreen: (failure: Error, onCaughtError = warnings.onCaughtError) =>
				open(
					`render a screen that throws ${failure.name}: ${failure.message} inside a catch boundary`,
					<CatchBoundary errorComponent={() => <p role="alert">Screen unavailable</p>} getResetKey={() => "screen"}>
						<BrokenScreen failure={failure} />
					</CatchBoundary>,
					{ onCaughtError },
				),
			openWarningScreen: () => open("render a controlled field without onChange", <input value="Uneditable screen field" />),
			shown: () => Effect.sync(() => screen().textContent),
			warnings: () => Effect.sync(() => warnings.read()),
		};
	},
});
