import { RegistryContext } from "@effect/atom-react";
import { RouterProvider } from "@tanstack/react-router";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { createRoot } from "react-dom/client";
import { appRouter } from "./appRouter.tsx";
import { makeNotesClient } from "./makeNotes.ts";
import "#client/entry.css";

const container = document.getElementById("root");
if (container === null) {
	throw new Error("Missing application root");
}
const registry = AtomRegistry.make();
const client = makeNotesClient(new URL("/rpc", window.location.href).href);
const router = appRouter(registry, client);
createRoot(container).render(
	<RegistryContext.Provider value={registry}>
		<RouterProvider router={router} />
	</RegistryContext.Provider>,
);
