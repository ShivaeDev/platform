import { Effect } from "effect";
import { act, type ReactNode } from "react";
import type { RootOptions } from "react-dom/client";
import { expectNoReactWarnings, type Rendered, render } from "@shivaedev/test-story/client/adapters/react.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
export const screenWarnings = expectNoReactWarnings();

export class Screen {
	readonly roots: Rendered[] = [];
	tell: (line: string) => void;
	constructor(tell: (line: string) => void) {
		this.tell = tell;
	}
	driver(root: HTMLElement) {
		return screenDriver({ act, root, tell: this.tell });
	}
	open(node: ReactNode = null, options?: RootOptions) {
		const roots = this.roots;
		return Effect.acquireRelease(
			Effect.promise(async () => {
				const view = await render(node, options);
				roots.push(view);
				return view;
			}),
			(view) => Effect.promise(view.unmount),
		);
	}
	act(line: string, run: () => unknown | Promise<unknown>) {
		this.tell(line);
		return Effect.promise(async () => {
			await act(async () => {
				await run();
			});
		});
	}
	inspect() {
		return {
			screens: this.roots.map(({ container }) => ({
				connected: container.isConnected,
				html: container.innerHTML,
				inputs: [...container.querySelectorAll("input")].map(({ name, value }) => ({ name, value })),
			})),
		};
	}
}
