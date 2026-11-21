import type { BetterAuthOptions } from "better-auth";
import type { AccessPolicy, RoleSet } from "@shivaedev/access/roleSet.ts";

export type AuthDeclaration<TOptions extends BetterAuthOptions = BetterAuthOptions> = { readonly options: TOptions } & (
	| { readonly defaultRole?: undefined; readonly roles?: undefined }
	| { readonly defaultRole: string; readonly roles: RoleSet }
);

export interface RoleAuthDeclaration<TRole extends string, TOptions extends BetterAuthOptions = BetterAuthOptions> {
	readonly defaultRole: TRole;
	readonly options: TOptions;
	readonly roles: AccessPolicy<TRole>;
}

export interface RoleTables<TRole extends string> {
	readonly options?: BetterAuthOptions | undefined;
	readonly roles: Pick<AccessPolicy<TRole>, "Role" | "hasPermission">;
}

export function defineAuth<const TOptions extends BetterAuthOptions, TRole extends string>(declaration: {
	readonly defaultRole: NoInfer<TRole>;
	readonly options: TOptions;
	readonly roles: AccessPolicy<TRole>;
}): RoleAuthDeclaration<TRole, TOptions>;
export function defineAuth<const TOptions extends BetterAuthOptions>(declaration: { readonly options: TOptions }): AuthDeclaration<TOptions>;
export function defineAuth(declaration: AuthDeclaration) {
	return declaration;
}
