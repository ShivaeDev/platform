import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { RouterProvider } from "#RouterProvider.ts";

const root = createRootRoute({ component: Outlet });

function SignIn() {
	return <output data-answer="sign-in">sign-in form</output>;
}

const routeTree = root.addChildren([createRoute({ component: SignIn, getParentRoute: () => root, path: "/sign-in" })]);

export function SignedOutRoutes() {
	const [router] = useState(() => createRouter({ history: createMemoryHistory({ initialEntries: ["/sign-in"] }), routeTree }));
	return <RouterProvider router={router} />;
}
