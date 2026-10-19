import { CatchBoundary } from "@tanstack/react-router";
import { Effect } from "effect";
import type { ReactNode } from "react";
import type { RootOptions } from "react-dom/client";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { captureReactWarnings, render } from "#client/testing.ts";
import { BrokenScreen } from "./BrokenScreen.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

export const warningScreen = storyKit({
	clock: "live",
	create: () => captureReactWarnings,
	inspect: (warnings) => warnings.read(),
	name: "React warning screen",
	stages: ["screen"],
	verbs: (warnings, story) => {
		function open(node: ReactNode, options?: RootOptions) {
			story.tell("render the screen");
			return Effect.acquireRelease(
				Effect.promise(() => render(node, options)),
				(view) => Effect.promise(view.unmount),
			);
		}
		return {
			expectCaughtError: warnings.expectCaughtError,
			openCleanScreen: () => open(<h1>Screen ready</h1>),
			openFailedScreen: (failure: Error, onCaughtError = warnings.onCaughtError) =>
				open(
					<CatchBoundary errorComponent={() => <p role="alert">Screen unavailable</p>} getResetKey={() => "screen"}>
						<BrokenScreen failure={failure} />
					</CatchBoundary>,
					{ onCaughtError },
				),
			openWarningScreen: () => open(<input value="Uneditable screen field" />),
			warnings: warnings.read,
		};
	},
});
