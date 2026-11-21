import { createRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { clientModule } from "@shivaedev/react/client/module.ts";
import { AdminShell } from "#client/admin/Shell.tsx";
import { Admin, StatisticsPage } from "#modules/notes/admin/pages.ts";
import { NoteStatisticsView } from "#modules/notes/client/admin/StatisticsView.tsx";

export const notesAdminModule = clientModule({ statistics: StatisticsPage.contract }, ({ statistics }) => ({
	admin: Admin,
	routes: (root) => [
		createRoute({
			component: (): ReactElement => (
				<AdminShell pages={root.useRouteContext().adminPages} title={StatisticsPage.route.title}>
					<NoteStatisticsView client={statistics} />
				</AdminShell>
			),
			getParentRoute: () => root,
			path: StatisticsPage.route.path,
		}),
	],
}));
