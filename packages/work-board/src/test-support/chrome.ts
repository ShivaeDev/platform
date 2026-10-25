import { Effect } from "effect";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { renderRouter } from "./renderRouter.tsx";

export async function chrome(files: Record<string, string>, url = "/notes/plan.md") {
	const view = await renderRouter(files, url);
	await Effect.runPromise(
		eventually(() => {
			if (view.container.querySelector("#doc")?.getAttribute("data-route") !== url) {
				throw new Error(`The shell is still opening ${url}`);
			}
		}),
	);
	const api = view.router.options.context?.shell?.api;
	if (!api) {
		throw new Error("Missing shell API");
	}
	return { ...view, api };
}
export function control<T extends HTMLElement>(selector: string, kind: { new (): T }): T {
	const element = document.querySelector(selector);
	if (!(element instanceof kind)) {
		throw new Error(`Missing ${selector}`);
	}
	return element;
}
