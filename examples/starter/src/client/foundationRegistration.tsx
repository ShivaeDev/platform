import { createRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { JobsView } from "@shivaedev/admin/client/JobsView.ts";
import { UsersView } from "@shivaedev/admin/client/UsersView.ts";
import { AppAccess } from "#AppAccess.ts";
import { routerRedirect } from "#client/adapters/routerRedirect.ts";
import { type FoundationClient, makeFoundationClient } from "#client/admin/foundation.ts";
import { AdminSessions } from "#client/admin/Sessions.tsx";
import { AdminShell } from "#client/admin/Shell.tsx";
import { foundation } from "#modules.ts";
import type { RouteContext } from "./Module.ts";

export function foundationRegistration(client: FoundationClient = makeFoundationClient(new URL("/rpc", window.location.href).href)) {
	return {
		admin: foundation.admin,
		api: client.users,
		bindings: [client.users, client.jobs, client.sessions],
		routes: ({ getParentRoute }: RouteContext) => {
			const parent = createRoute({ context: () => ({ client }), getParentRoute, id: "foundation" });
			const index = createRoute({
				beforeLoad: (): never => routerRedirect(foundation.JobsPage.route.path),
				getParentRoute: () => parent,
				path: "/admin",
			});
			const users = createRoute({
				component: (): ReactElement => {
					const { client: routeClient, adminPages } = users.useRouteContext();
					return (
						<AdminShell pages={adminPages} title={foundation.UsersPage.route.title}>
							<UsersView changeRole={routeClient.changeRole} list={routeClient.users.list.query} roles={AppAccess.Role.literals} />
						</AdminShell>
					);
				},
				getParentRoute: () => parent,
				path: "/admin/users",
				staticData: { permission: foundation.UsersPage.route.permission },
			});
			const jobs = createRoute({
				component: (): ReactElement => {
					const { client: routeClient, adminPages } = jobs.useRouteContext();
					return (
						<AdminShell pages={adminPages} title={foundation.JobsPage.route.title}>
							<JobsView api={routeClient.jobs} queues={foundation.queues.map(({ name }) => name)} retry={routeClient.retry} />
						</AdminShell>
					);
				},
				getParentRoute: () => parent,
				path: "/admin/jobs",
				staticData: { permission: foundation.JobsPage.route.permission },
			});
			const sessions = createRoute({
				component: (): ReactElement => {
					const { client: routeClient, adminPages, auth, session } = sessions.useRouteContext();
					return (
						<AdminShell pages={adminPages} title={foundation.SessionsPage.route.title}>
							<AdminSessions auth={auth} client={routeClient} currentSessionId={session()?.session?.id} />
						</AdminShell>
					);
				},
				getParentRoute: () => parent,
				path: "/admin/sessions",
				staticData: { permission: foundation.SessionsPage.route.permission },
			});
			return [parent.addChildren([index, users, jobs, sessions])];
		},
	};
}
