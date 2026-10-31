import { registerAdmin } from "@shivaedev/admin/server/registerAdmin.ts";
import { rpcBoundary } from "@shivaedev/errors/boundary.ts";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import { Admin, StatisticsPage } from "#modules/notes/admin/pages.ts";
import { readStatistics } from "./readStatistics.ts";

const statistics = StatisticsPage.contract.application.toLayer({
	"admin.notes.statistics": () =>
		readStatistics().pipe(
			rpcBoundary(StatisticsPage.contract.declaration.queries[0].error, { unexpected: (message) => new InternalServerError({ message }) }),
		),
});

export const adminRegistration = registerAdmin(Admin, {
	"note-statistics": statistics,
});
