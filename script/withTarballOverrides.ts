const OVERRIDES_HEADING = /^overrides:[ \t]*\n/mu;

export function withTarballOverrides(workspace: string, tarballs: Readonly<Record<string, string>>): string {
	const keys = Object.keys(tarballs).map((name) => `  ${JSON.stringify(name)}:`);
	let inOverrides = false;
	const source = workspace
		.split("\n")
		.filter((line) => {
			if (/^\S/u.test(line) && !line.startsWith("#")) {
				inOverrides = OVERRIDES_HEADING.test(`${line}\n`);
			}
			return !(inOverrides && keys.some((key) => line.startsWith(key)));
		})
		.join("\n");
	const entries = Object.entries(tarballs)
		.map(([name, tarball]) => `  "${name}": "file:${tarball}"\n`)
		.join("");
	return OVERRIDES_HEADING.test(source)
		? source.replace(OVERRIDES_HEADING, (heading) => `${heading}${entries}`)
		: `${source.trimEnd()}\n\noverrides:\n${entries}`;
}
