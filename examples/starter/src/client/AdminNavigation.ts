import type { Permission } from "@shivaedev/access/permission.ts";

export interface AdminNavigation {
	readonly id: string;
	readonly route: { readonly path: string; readonly detail?: string; readonly permission: Permission; readonly title: string };
}
