import { renderRouter } from "./renderRouter.tsx";

export async function chrome(files: Record<string, string>, url = "/notes/plan.md") {
	const view = await renderRouter(files, url);
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
