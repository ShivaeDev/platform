import { createRoute, redirect } from "@tanstack/react-router";
import { UsersView } from "@shivaedev/admin/client/UsersView.ts";
import { UsersPage } from "@shivaedev/admin/users/page.ts";
import { JobsView } from "#client/admin/JobsView.tsx";
import { AdminShell } from "#client/admin/Shell.tsx";
import type { RouteContext } from "#client/Module.ts";
import { Admin, JobsPage, StatisticsPage } from "#modules/notes/admin.ts";
import type { AdminClient } from "./admin.ts";
import { NoteStatisticsView } from "./StatisticsView.tsx";

export function adminRoutes(client: AdminClient, { root }: RouteContext) {
	return [
		createRoute({
			beforeLoad: () => {
				throw redirect({ to: JobsPage.route.path });
			},
			getParentRoute: () => root,
			path: "/admin",
		}),
		createRoute({
			component: () => (
				<AdminShell pages={Admin.pages} title={UsersPage.route.title}>
					<UsersView changeRole={client.changeRole} list={client.users.list.query} />
				</AdminShell>
			),
			getParentRoute: () => root,
			path: UsersPage.route.path,
		}),
		createRoute({
			component: () => (
				<AdminShell pages={Admin.pages} title={JobsPage.route.title}>
					<JobsView api={client.jobs} queues={JobsPage.queues} retry={client.retry} />
				</AdminShell>
			),
			getParentRoute: () => root,
			path: JobsPage.route.path,
		}),
		createRoute({
			component: () => (
				<AdminShell pages={Admin.pages} title={StatisticsPage.route.title}>
					<NoteStatisticsView client={client} />
				</AdminShell>
			),
			getParentRoute: () => root,
			path: StatisticsPage.route.path,
		}),
	];
}
