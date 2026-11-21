import { createRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import type { ContractClient } from "@shivaedev/contract/makeClient.ts";
import { AdminShell } from "#client/admin/Shell.tsx";
import type { RouteContext } from "#client/Module.ts";
import { Admin, StatisticsPage } from "#modules/notes/admin/pages.ts";
import { NoteStatisticsView } from "#modules/notes/client/admin/StatisticsView.tsx";

export function adminRegistration(client: ContractClient<typeof StatisticsPage.contract>) {
	return {
		admin: Admin,
		api: client,
		routes: ({ getParentRoute }: RouteContext) => {
			const parent = createRoute({ getParentRoute, id: "notesAdmin" });
			const statistics = createRoute({
				component: (): ReactElement => {
					const { adminPages } = statistics.useRouteContext();
					return (
						<AdminShell pages={adminPages} title={StatisticsPage.route.title}>
							<NoteStatisticsView client={client} />
						</AdminShell>
					);
				},
				getParentRoute: () => parent,
				path: StatisticsPage.route.path,
			});
			return [parent.addChildren([statistics])];
		},
	};
}
