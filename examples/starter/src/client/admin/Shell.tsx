import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { Permission } from "@shivaedev/access/permission.ts";
import { useCan } from "@shivaedev/react/client/permissionBoundary.ts";

export interface AdminNavigation {
	readonly id: string;
	readonly route: { readonly path: string; readonly permission: Permission; readonly title: string };
}

export function AdminShell({
	pages,
	title,
	children,
}: {
	readonly pages: readonly AdminNavigation[];
	readonly title: string;
	readonly children: ReactNode;
}) {
	const can = useCan();
	return (
		<div className="mx-auto grid min-h-screen w-full max-w-7xl content-start gap-6 p-4 sm:p-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10 lg:py-10">
			<aside className="space-y-5">
				<div className="flex items-center justify-between gap-4">
					<Link className="text-xl font-semibold" to="/">
						Your app
					</Link>
				</div>
				<nav aria-label="Administration" className="flex flex-wrap gap-2 lg:flex-col">
					{pages
						.filter((page) => can(page.route.permission))
						.map((page) => (
							<AdminLink key={page.id} page={page} />
						))}
				</nav>
			</aside>
			<main className="min-w-0 space-y-6">
				<header className="space-y-1">
					<p className="text-muted-foreground text-sm">Administration</p>
					<h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
				</header>
				{children}
			</main>
		</div>
	);
}

function AdminLink({ page }: { readonly page: AdminNavigation }) {
	return (
		<Link activeProps={{ className: "bg-muted font-semibold" }} className="hover:bg-muted rounded-md px-3 py-2 text-sm" to={page.route.path}>
			{page.route.title}
		</Link>
	);
}
