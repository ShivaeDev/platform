import { SqlClient } from "effect/sql";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { adminNotesWire } from "#generated/modules/notes/admin/Statistics.ts";
import { StatisticsPermission } from "#modules/notes/admin/StatisticsPermission.ts";
import { Read } from "#modules/notes/server/admin/Read.ts";

export const Statistics = defineModule({
	middleware: StatisticsPermission,
	name: "admin.notes",
	operations: [Read],
	requires: [SqlClient.SqlClient],
	wire: adminNotesWire,
});
