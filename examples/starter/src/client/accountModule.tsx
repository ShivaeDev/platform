import { createRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { clientModule } from "@shivaedev/react/client/module.ts";
import { useSessionRecheck } from "@shivaedev/react/client/sessionBoundary.ts";
import { LoginScreen } from "#client/LoginScreen.tsx";
import { ResetPassword } from "#client/ResetPassword.tsx";

export const accountModule = clientModule({}, () => ({
	routes: (root) => {
		const signIn = createRoute({
			component: (): ReactElement => <LoginScreen auth={root.useRouteContext().auth} onAuthenticated={useSessionRecheck()} />,
			getParentRoute: () => root,
			path: "/sign-in",
			validateSearch: (search: Record<string, unknown>) => (typeof search.returnTo === "string" ? { returnTo: search.returnTo } : {}),
		});
		const resetPassword = createRoute({
			component: (): ReactElement => <ResetPassword auth={root.useRouteContext().auth} token={resetPassword.useSearch().token} />,
			getParentRoute: () => root,
			path: "/reset-password",
			validateSearch: (search: Record<string, unknown>) => ({ token: typeof search.token === "string" ? search.token : "" }),
		});
		return [signIn, resetPassword];
	},
}));
