import { RegistryContext } from "@effect/atom-react";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";
import { legacyRuntime, session } from "#client/entry.ts";
import { boardRouter } from "./boardRouter.ts";
import "#client/react/entry.css";

const container = document.querySelector("[data-board-react-root]");
const bootstrap = document.querySelector<HTMLTemplateElement>("#board-legacy-page");
if (container && bootstrap) {
	document.querySelector("[data-board-fallback]")?.remove();
	const initial = bootstrap.innerHTML;
	for (const dialog of bootstrap.content.querySelectorAll("dialog")) {
		document.body.append(dialog.cloneNode(true));
	}
	bootstrap.remove();
	const root = createRoot(container);
	let native = session(window);
	let started = false;
	function ready() {
		if (started) {
			return;
		}
		started = true;
		void legacyRuntime().then(({ connectRouter }) => {
			connectRouter({
				navigate: (url) =>
					url === location.pathname + location.search + location.hash ? router.navigate({ state: true, to: url }) : router.navigate({ to: url }),
				subscribe: (listener) => {
					router.subscribe("onResolved", listener);
				},
			});
			document.documentElement.dataset.boardReady = "true";
		});
	}
	const reading = history.state?.workBoard;
	const router = boardRouter({ api: native.api, initial, ready });
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
		router.update({ context: { shell: { api: native.api, initial, ready } } });
		render();
	});
}
