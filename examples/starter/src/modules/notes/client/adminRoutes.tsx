import { createRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { permissionGuard } from "@shivaedev/react/permissionGuard.ts";
import { AdminShell } from "#client/admin/Shell.tsx";
import type { AdminRouteContext } from "#client/Module.ts";
import { StatisticsPage } from "#modules/notes/admin.ts";
import type { AdminClient } from "./admin.ts";
import { NoteStatisticsView } from "./StatisticsView.tsx";

export function adminRoutes(client: AdminClient, { getParentRoute, session, adminPages }: AdminRouteContext) {
	const guard = permissionGuard({ session, signIn: "/sign-in" });
	return [
		createRoute({
			beforeLoad: (context): void => guard(context),
			component: (): ReactElement => (
				<AdminShell pages={adminPages} title={StatisticsPage.route.title}>
					<NoteStatisticsView client={client} />
				</AdminShell>
			),
			getParentRoute,
			path: "/admin/notes",
			staticData: { permission: StatisticsPage.route.permission },
		}),
	];
}
