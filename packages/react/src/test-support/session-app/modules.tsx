import { createRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { permission } from "@shivaedev/access/permission.ts";
import { clientModule } from "#client/module.ts";
import { Counter } from "#test/client-app/backend.ts";
import { CountView } from "#test/client-app/views.tsx";
import { Diary } from "#test/session-app/backend.ts";
import { Broken, DiaryView, SignIn } from "#test/session-app/screens.tsx";

export const ReadReports = permission("reports.read");

export const accountModule = clientModule({}, () => ({
	routes: (root) => [createRoute({ component: SignIn, getParentRoute: () => root, path: "/sign-in" })],
}));

export const countModule = clientModule({ tally: Counter }, ({ tally }) => ({
	routes: (root) => [
		createRoute({
			component: (): ReactElement => (
				<main>
					<h1>Count</h1>
					<CountView counter={tally} name="Count" />
				</main>
			),
			getParentRoute: () => root,
			path: "/count",
		}),
	],
}));

export const notesModule = clientModule({}, () => ({
	routes: (root) => {
		const notes = createRoute({
			component: (): ReactElement => <h1>Notes for {notes.useRouteContext().session()?.user.id}</h1>,
			getParentRoute: () => root,
			path: "/notes",
			staticData: { signedIn: true },
		});
		return [notes];
	},
}));

// The page declares its detail path with another parameter name than the app's routes, as an admin page and its app route are written apart.
export const reportsModule = clientModule({}, () => ({
	admin: {
		pages: [{ id: "reports", route: { detail: "/admin/reports/$id", path: "/admin/reports", permission: ReadReports, title: "Reports" } }],
	},
	routes: (root) => [
		createRoute({ component: () => <h1>Admin index</h1>, getParentRoute: () => root, path: "/admin" }),
		createRoute({ component: () => <h1>Reports</h1>, getParentRoute: () => root, path: "/admin/reports" }),
		createRoute({ component: () => <h1>New report</h1>, getParentRoute: () => root, path: "/admin/reports/new" }),
		createRoute({ component: () => <h1>Report</h1>, getParentRoute: () => root, path: "/admin/reports/{$reportId}" }),
	],
}));

export const diaryModule = clientModule({ diary: Diary }, ({ diary }) => ({
	routes: (root) => [createRoute({ component: () => <DiaryView diary={diary} />, getParentRoute: () => root, path: "/diary" })],
}));

export const brokenModule = clientModule({}, () => ({
	routes: (root) => [createRoute({ component: Broken, errorComponent: () => <h1>Broken</h1>, getParentRoute: () => root, path: "/broken" })],
}));
