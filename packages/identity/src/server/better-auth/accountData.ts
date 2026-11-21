import { getAuthTables } from "better-auth/db";
import { Effect } from "effect";
import { checkCoverage } from "#server/account-data/checkCoverage.ts";
import { eraseOwnedRows } from "#server/account-data/eraseOwnedRows.ts";
import { exportOwnedRows } from "#server/account-data/exportOwnedRows.ts";
import type { TableColumn } from "#server/account-data/UncoveredUserColumns.ts";
import type { AuthSchemaDeclaration } from "#server/better-auth/define.ts";
import { profileExport } from "#server/better-auth/profileExport.ts";

export function accountData(auth: Pick<AuthSchemaDeclaration, "options">, reference?: TableColumn) {
	const tables = getAuthTables(auth.options);
	const user = reference ?? { column: "id", schema: "public", table: tables.user?.modelName ?? "user" };
	const check = checkCoverage(user, new Set(Object.values(tables).map(({ modelName }) => modelName)));
	const exportProfile = profileExport(auth.options, user.schema);
	return {
		check,
		eraseOwnedRows: Effect.fn("AccountData.eraseOwnedRows")(function* (userId: string) {
			yield* check;
			yield* eraseOwnedRows(userId);
		}),
		exportAccount: Effect.fn("AccountData.exportAccount")(function* (userId: string) {
			yield* check;
			return { account: yield* exportProfile(userId), owned: yield* exportOwnedRows(userId) };
		}),
	};
}
