import { RegistryProvider } from "@effect/atom-react";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";
import { boardRouter } from "./boardRouter.ts";
import "#browser/react/entry.css";

const container = document.querySelector("[data-board-react-root]");
if (container) {
	createRoot(container).render(
		<RegistryProvider>
			<RouterProvider router={boardRouter()} />
		</RegistryProvider>,
	);
}
