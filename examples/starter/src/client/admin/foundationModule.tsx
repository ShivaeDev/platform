import { createRoute, redirect } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { JobsView } from "@shivaedev/admin/client/JobsView.ts";
import { UsersView } from "@shivaedev/admin/client/UsersView.ts";
import { clientModule } from "@shivaedev/react/client/module.ts";
import { AppAccess } from "#AppAccess.ts";
import { foundation } from "#admin/foundation.ts";
import { AdminSessions } from "#client/admin/Sessions.tsx";
import { AdminShell } from "#client/admin/Shell.tsx";

const contracts = { jobs: foundation.JobsPage.contract, sessions: foundation.SessionsPage.contract, users: foundation.UsersPage.contract };

export const foundationModule = clientModule(contracts, ({ jobs, sessions, users }) => {
	const changeRole = users.changeRole.runtime.fn(users.changeRole.run);
	return {
		admin: foundation.admin,
		routes: (root) => {
			const index = createRoute({
				beforeLoad: () => redirect({ href: foundation.JobsPage.route.path }),
				getParentRoute: () => root,
				path: "/admin",
			});
			const usersPage = createRoute({
				component: (): ReactElement => (
					<AdminShell pages={root.useRouteContext().adminPages} title={foundation.UsersPage.route.title}>
						<UsersView changeRole={changeRole} list={users.list.query} roles={AppAccess.Role.literals} />
					</AdminShell>
				),
				getParentRoute: () => root,
				path: foundation.UsersPage.route.path,
			});
			const jobsPage = createRoute({
				component: (): ReactElement => (
					<AdminShell pages={root.useRouteContext().adminPages} title={foundation.JobsPage.route.title}>
						<JobsView api={jobs} queues={foundation.queues.map(({ name }) => name)} />
					</AdminShell>
				),
				getParentRoute: () => root,
				path: foundation.JobsPage.route.path,
			});
			const sessionsPage = createRoute({
				component: (): ReactElement => {
					const { adminPages, auth, session } = root.useRouteContext();
					return (
						<AdminShell pages={adminPages} title={foundation.SessionsPage.route.title}>
							<AdminSessions auth={auth} client={sessions} currentSessionId={session()?.session?.id} />
						</AdminShell>
					);
				},
				getParentRoute: () => root,
				path: foundation.SessionsPage.route.path,
			});
			return [index, usersPage, jobsPage, sessionsPage];
		},
	};
});
