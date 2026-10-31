const RUNTIME = /^(?:client|server|test-support)\//u;

export function moduleRoot(path: string): string | undefined {
	const match = /^(?<root>(?:.*\/)?src\/modules\/[^/]+)\/(?<local>.+)$/u.exec(path)?.groups;
	if (match?.root === undefined || match.local === undefined) {
		return undefined;
	}
	if (RUNTIME.test(match.local)) {
		return match.root;
	}
	const separator = match.local.indexOf("/");
	return separator > 0 && RUNTIME.test(match.local.slice(separator + 1)) ? `${match.root}/${match.local.slice(0, separator)}` : undefined;
}
