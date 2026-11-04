import { Effect } from "effect";
import { checkUserDataExports } from "#server/account-export/check.ts";
import { userReference } from "#server/better-auth/userReference.ts";
import type { UserDataExport, UserExportReference } from "#server/userDataExport.ts";

type ExportEffects<T extends Readonly<Record<string, UserDataExport>>> = ReturnType<T[keyof T]["export"]>;
type ExportCoverage = ReturnType<typeof checkUserDataExports>;
type ExportData<T extends Readonly<Record<string, UserDataExport>>> = {
	readonly [TDomain in keyof T]: Effect.Success<ReturnType<T[TDomain]["export"]>>;
};

export function accountExport<const T extends Readonly<Record<string, UserDataExport>>>(
	registrations: T,
	reference?: UserExportReference,
): {
	readonly check: ExportCoverage;
	readonly exportUser: (
		userId: string,
	) => Effect.Effect<
		ExportData<T>,
		Effect.Error<ExportEffects<T>> | Effect.Error<ExportCoverage>,
		Effect.Services<ExportEffects<T>> | Effect.Services<ExportCoverage>
	>;
};
export function accountExport(
	registrations: Readonly<Record<string, UserDataExport>>,
	reference: UserExportReference = { ...userReference, schema: "public" },
) {
	const check = checkUserDataExports(registrations, reference);
	return {
		check,
		exportUser: Effect.fn("Identity.exportUser")(function* (userId: string) {
			yield* check;
			const entries = yield* Effect.forEach(Object.entries(registrations), ([domain, registration]) =>
				registration.export(userId).pipe(Effect.map((data) => [domain, data] as const)),
			);
			return Object.fromEntries(entries);
		}),
	};
}
