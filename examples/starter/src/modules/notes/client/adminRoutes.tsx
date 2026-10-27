import { createRoute, redirect } from "@tanstack/react-router";
import { UsersView } from "@shivaedev/admin/client/UsersView.ts";
import { permissionGuard } from "@shivaedev/react/permissionGuard.ts";
import { AppAccess } from "#AppAccess.ts";
import { JobsView } from "#client/admin/JobsView.tsx";
import { AdminShell } from "#client/admin/Shell.tsx";
import type { RouteContext } from "#client/Module.ts";
import { Admin, JobsPage, StatisticsPage, UsersPage } from "#modules/notes/admin.ts";
import type { AdminClient } from "./admin.ts";
import { NoteStatisticsView } from "./StatisticsView.tsx";

export function adminRoutes(client: AdminClient, { root, session }: RouteContext) {
	const guard = permissionGuard({ session, signIn: "/sign-in" });
	return [
		createRoute({
			beforeLoad: () => {
				throw redirect({ to: JobsPage.route.path });
			},
			getParentRoute: () => root,
			path: "/admin",
		}),
		createRoute({
			beforeLoad: guard,
			component: () => (
				<AdminShell pages={Admin.pages} title={UsersPage.route.title}>
					<UsersView changeRole={client.changeRole} list={client.users.list.query} roles={AppAccess.Role.literals} />
				</AdminShell>
			),
			getParentRoute: () => root,
			path: UsersPage.route.path,
			staticData: { permission: UsersPage.route.permission },
		}),
		createRoute({
			beforeLoad: guard,
			component: () => (
				<AdminShell pages={Admin.pages} title={JobsPage.route.title}>
					<JobsView api={client.jobs} queues={JobsPage.queues} retry={client.retry} />
				</AdminShell>
			),
			getParentRoute: () => root,
			path: JobsPage.route.path,
			staticData: { permission: JobsPage.route.permission },
		}),
		createRoute({
			beforeLoad: guard,
			component: () => (
				<AdminShell pages={Admin.pages} title={StatisticsPage.route.title}>
					<NoteStatisticsView client={client} />
				</AdminShell>
			),
			getParentRoute: () => root,
			path: StatisticsPage.route.path,
			staticData: { permission: StatisticsPage.route.permission },
		}),
	];
}
