import { createRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { UsersView } from "@shivaedev/admin/client/UsersView.ts";
import { permissionGuard } from "@shivaedev/react/permissionGuard.ts";
import { AppAccess } from "#AppAccess.ts";
import { routerRedirect } from "#client/adapters/routerRedirect.ts";
import { JobsView } from "#client/admin/JobsView.tsx";
import { AdminShell } from "#client/admin/Shell.tsx";
import type { AdminRouteContext } from "#client/Module.ts";
import { foundation } from "#modules.ts";
import type { FoundationClient } from "./foundation.ts";

export function foundationRoutes(client: FoundationClient, { getParentRoute, session, adminPages }: AdminRouteContext) {
	const guard = permissionGuard({ session, signIn: "/sign-in" });
	return [
		createRoute({
			beforeLoad: (): never => routerRedirect(foundation.JobsPage.route.path),
			getParentRoute,
			path: "/admin",
		}),
		createRoute({
			beforeLoad: (context): void => guard(context),
			component: (): ReactElement => (
				<AdminShell pages={adminPages} title={foundation.UsersPage.route.title}>
					<UsersView changeRole={client.changeRole} list={client.users.list.query} roles={AppAccess.Role.literals} />
				</AdminShell>
			),
			getParentRoute,
			path: "/admin/users",
			staticData: { permission: foundation.UsersPage.route.permission },
		}),
		createRoute({
			beforeLoad: (context): void => guard(context),
			component: (): ReactElement => (
				<AdminShell pages={adminPages} title={foundation.JobsPage.route.title}>
					<JobsView api={client.jobs} queues={foundation.JobsPage.queues} retry={client.retry} />
				</AdminShell>
			),
			getParentRoute,
			path: "/admin/jobs",
			staticData: { permission: foundation.JobsPage.route.permission },
		}),
	];
}
