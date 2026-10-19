import { RegistryContext } from "@effect/atom-react";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";
import type { BrowserClient } from "#browserClient.ts";
import { TooltipProvider } from "#client/react/components/ui/tooltip.tsx";
import { boardRouter } from "./boardRouter.ts";

export function mountBoard(container: Element, readSession: () => BrowserClient) {
	const root = createRoot(container);
	let native = readSession();
	let generation = 0;
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
	let router = boardRouter({ api: native.api, client: native, reading, ready, registry: native.registry });
	const navigation = router.history;
	if (reading) {
		history.replaceState({ ...history.state, workBoard: reading }, "");
	}
	function render() {
		root.render(
			<RegistryContext.Provider key={generation} value={native.registry}>
				<TooltipProvider>
					<RouterProvider router={router} />
				</TooltipProvider>
			</RegistryContext.Provider>,
		);
	}
	render();
	function restore(event: PageTransitionEvent) {
		if (!event.persisted) {
			return;
		}
		native = readSession();
		generation += 1;
		router = boardRouter({ api: native.api, client: native, reading, ready, registry: native.registry }, navigation);
		render();
	}
	window.addEventListener("pageshow", restore);
	return () => {
		window.removeEventListener("pageshow", restore);
		root.unmount();
		navigation.destroy();
	};
}
