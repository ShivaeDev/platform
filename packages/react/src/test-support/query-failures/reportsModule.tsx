import { createRoute } from "@tanstack/react-router";
import { queryRoute } from "#client/adapters/queryRoute.ts";
import { clientModule } from "#client/module.ts";
import { type ReportBackend, Reports, reportFailures, summaryAtom } from "#test/query-failures/backend.ts";
import { ReportEditor, ReportScreen } from "#test/query-failures/screens.tsx";

export function reportsModule(backend: ReportBackend) {
	return clientModule({ reports: Reports }, ({ reports }) => ({
		routes: (root) => {
			const report = queryRoute(() => reports.report.query(), { failures: reportFailures });
			const summaryQuery = summaryAtom(backend);
			const summary = queryRoute(() => summaryQuery);
			return [
				createRoute({ component: () => <ReportScreen report={summary.useQuery()} />, getParentRoute: () => root, ...summary, path: "/summary" }),
				createRoute({
					component: () => <ReportScreen report={report.useQuery()} />,
					getParentRoute: () => root,
					...report,
					path: "/report",
				}),
				createRoute({
					component: () => <ReportEditor report={report.useLoaded()} reports={reports} />,
					getParentRoute: () => root,
					...report,
					path: "/report/edit",
				}),
			];
		},
	}));
}
