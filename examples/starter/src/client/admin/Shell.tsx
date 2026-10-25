import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export interface AdminNavigation {
	readonly id: string;
	readonly route: { readonly path: string; readonly title: string };
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
	return (
		<div className="mx-auto grid min-h-screen w-full max-w-7xl content-start gap-6 p-4 sm:p-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10 lg:py-10">
			<aside className="space-y-5">
				<div className="flex items-center justify-between gap-4">
					<Link className="font-semibold text-xl" to="/">
						Your app
					</Link>
				</div>
				<nav aria-label="Administration" className="flex flex-wrap gap-2 lg:flex-col">
					{pages.map((page) => (
						<Link
							activeProps={{ className: "bg-muted font-semibold" }}
							className="rounded-md px-3 py-2 text-sm hover:bg-muted"
							key={page.id}
							to={page.route.path}
						>
							{page.route.title}
						</Link>
					))}
				</nav>
			</aside>
			<main className="min-w-0 space-y-6">
				<header className="space-y-1">
					<p className="text-muted-foreground text-sm">Administration</p>
					<h1 className="font-semibold text-3xl tracking-tight">{title}</h1>
				</header>
				{children}
			</main>
		</div>
	);
}
