import { createRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { Account } from "@shivaedev/identity/generated/Account.ts";
import { clientModule } from "@shivaedev/react/client/module.ts";
import { useSessionRecheck } from "@shivaedev/react/client/sessionBoundary.ts";
import { AccountScreen } from "#client/AccountScreen.tsx";
import { LoginScreen } from "#client/LoginScreen.tsx";
import { ResetPassword } from "#client/ResetPassword.tsx";

export const accountModule = clientModule({ account: Account }, ({ account }) => ({
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
		const accountPage = createRoute({
			component: (): ReactElement => {
				const { navigate } = accountPage.useRouteContext();
				const recheck = useSessionRecheck();
				// Leaving for sign-in before the check answers lets its signed-out answer find the person on a public route.
				return (
					<AccountScreen
						client={account}
						onDeleted={() => {
							navigate("/sign-in");
							recheck();
						}}
					/>
				);
			},
			getParentRoute: () => root,
			path: "/account",
			staticData: { signedIn: true },
		});
		return [signIn, resetPassword, accountPage];
	},
}));
