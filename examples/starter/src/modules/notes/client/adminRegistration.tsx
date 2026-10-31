import { createRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { permissionGuard } from "@shivaedev/react/permissionGuard.ts";
import { AdminShell } from "#client/admin/Shell.tsx";
import type { RouteContext } from "#client/Module.ts";
import { Admin, StatisticsPage } from "#modules/notes/admin.ts";
import type { AdminClient } from "./admin.ts";
import { NoteStatisticsView } from "./StatisticsView.tsx";

export function adminRegistration(client: AdminClient) {
	return {
		admin: Admin,
		api: client.statistics,
		routes: ({ getParentRoute }: RouteContext) => {
			const parent = createRoute({ context: () => ({ client }), getParentRoute, id: "notesAdmin" });
			const statistics = createRoute({
				beforeLoad: (route): void => permissionGuard({ session: route.context.session, signIn: "/sign-in" })(route),
				component: (): ReactElement => {
					const { client: routeClient, adminPages } = statistics.useRouteContext();
					return (
						<AdminShell pages={adminPages} title={StatisticsPage.route.title}>
							<NoteStatisticsView client={routeClient} />
						</AdminShell>
					);
				},
				getParentRoute: () => parent,
				path: "/admin/notes",
				staticData: { permission: StatisticsPage.route.permission },
			});
			return [parent.addChildren([statistics])];
		},
	};
}
