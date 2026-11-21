import { createRoute, redirect } from "@tanstack/react-router";
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { ReactElement } from "react";
import { JobsView } from "@shivaedev/admin/client/JobsView.ts";
import { UsersView } from "@shivaedev/admin/client/UsersView.ts";
import { type MadeClient, makeClient } from "@shivaedev/contract/makeClient.ts";
import { AppAccess } from "#AppAccess.ts";
import { foundation } from "#admin/foundation.ts";
import { AdminSessions } from "#client/admin/Sessions.tsx";
import { AdminShell } from "#client/admin/Shell.tsx";
import type { RouteContext } from "#client/Module.ts";

const foundationContracts = {
	jobs: foundation.JobsPage.contract,
	sessions: foundation.SessionsPage.contract,
	users: foundation.UsersPage.contract,
};

export type FoundationClient = Pick<MadeClient<typeof foundationContracts>, "api" | "runtime">;

export function foundationRegistration(client?: FoundationClient) {
	return Effect.map(AtomRegistry.AtomRegistry, (registry) => foundationModule(client ?? makeClient(foundationContracts, { registry })));
}

function foundationModule(client: FoundationClient) {
	const { jobs, sessions, users } = client.api;
	const changeRole = client.runtime.fn(users.changeRole.run);
	return {
		admin: foundation.admin,
		api: client.api,
		routes: ({ getParentRoute }: RouteContext) => {
			const parent = createRoute({ getParentRoute, id: "foundation" });
			const index = createRoute({
				beforeLoad: () => redirect({ href: foundation.JobsPage.route.path }),
				getParentRoute: () => parent,
				path: "/admin",
			});
			const usersPage = createRoute({
				component: (): ReactElement => {
					const { adminPages } = usersPage.useRouteContext();
					return (
						<AdminShell pages={adminPages} title={foundation.UsersPage.route.title}>
							<UsersView changeRole={changeRole} list={users.list.query} roles={AppAccess.Role.literals} />
						</AdminShell>
					);
				},
				getParentRoute: () => parent,
				path: foundation.UsersPage.route.path,
			});
			const jobsPage = createRoute({
				component: (): ReactElement => {
					const { adminPages } = jobsPage.useRouteContext();
					return (
						<AdminShell pages={adminPages} title={foundation.JobsPage.route.title}>
							<JobsView api={jobs} queues={foundation.queues.map(({ name }) => name)} />
						</AdminShell>
					);
				},
				getParentRoute: () => parent,
				path: foundation.JobsPage.route.path,
			});
			const sessionsPage = createRoute({
				component: (): ReactElement => {
					const { adminPages, auth, session } = sessionsPage.useRouteContext();
					return (
						<AdminShell pages={adminPages} title={foundation.SessionsPage.route.title}>
							<AdminSessions auth={auth} client={sessions} currentSessionId={session()?.session?.id} />
						</AdminShell>
					);
				},
				getParentRoute: () => parent,
				path: foundation.SessionsPage.route.path,
			});
			return [parent.addChildren([index, usersPage, jobsPage, sessionsPage])];
		},
	};
}
