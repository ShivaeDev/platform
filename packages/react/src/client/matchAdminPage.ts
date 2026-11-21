interface PageRoute {
	readonly route: { readonly detail?: string | undefined; readonly path: string };
}

function segments(path: string): readonly string[] {
	return path.replace(/\/$/u, "").split("/");
}

function isParameter(segment: string): boolean {
	return segment.startsWith("$") || /^\{-?\$[^}]*\}$/u.test(segment);
}

function matchesPath(declared: string, pathname: readonly string[]): boolean {
	const expected = segments(declared);
	return (
		expected.length === pathname.length
		&& expected.every((segment, index) => (isParameter(segment) ? pathname[index] !== "" : segment === pathname[index]))
	);
}

// Admin's matchAdminRoute applies these same rules on the server, and a test of admin's runs one table through both so they stay in step.
export function matchAdminPage<TPage extends PageRoute>(pages: readonly TPage[], pathname: string): TPage | undefined {
	const actual = segments(pathname);
	if (actual.join("/") === "/admin") {
		return pages[0];
	}
	return (
		pages.find(({ route }) => matchesPath(route.path, actual))
		?? pages.find(({ route }) => route.detail !== undefined && matchesPath(route.detail, actual))
	);
}
