const OVERRIDES_HEADING = /^overrides:[ \t]*\n/mu;

export function withTarballOverrides(workspace: string, tarballs: Readonly<Record<string, string>>): string {
	const entries = Object.entries(tarballs)
		.map(([name, tarball]) => `  "${name}": "file:${tarball}"\n`)
		.join("");
	return OVERRIDES_HEADING.test(workspace)
		? workspace.replace(OVERRIDES_HEADING, (heading) => `${heading}${entries}`)
		: `${workspace.trimEnd()}\n\noverrides:\n${entries}`;
}
