import { RegistryContext } from "@effect/atom-react";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";
import { session } from "#client/entry.ts";
import { boardRouter } from "./boardRouter.ts";
import "#client/react/entry.css";

const container = document.querySelector("[data-board-react-root]");
const bootstrap = document.querySelector<HTMLTemplateElement>("#board-legacy-page");
if (container && bootstrap) {
	document.querySelector("[data-board-fallback]")?.remove();
	const initial = bootstrap.innerHTML;
	bootstrap.remove();
	const root = createRoot(container);
	let native = session(window);
	let started = false;
	function ready() {
		if (started) {
			return;
		}
		started = true;
		document.documentElement.dataset.boardReady = "true";
		document.documentElement.dataset.js = "true";
	}
	const reading = history.state?.workBoard;
	const router = boardRouter({ api: native.api, client: native, initial, reading, ready, registry: native.registry });
	if (reading) {
		history.replaceState({ ...history.state, workBoard: reading }, "");
	}
	function render() {
		root.render(
			<RegistryContext.Provider value={native.registry}>
				<RouterProvider router={router} />
			</RegistryContext.Provider>,
		);
	}
	render();
	window.addEventListener("pageshow", (event) => {
		if (!event.persisted) {
			return;
		}
		native = session(window);
		router.update({ context: { shell: { api: native.api, client: native, initial, reading, ready, registry: native.registry } } });
		void router.invalidate();
		render();
	});
}
