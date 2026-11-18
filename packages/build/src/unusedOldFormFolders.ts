import { Option } from "effect";

// An entry that excuses nothing would outlive its folder's move to defineModule and excuse the next old-form file written there.
export function unusedOldFormFolders(listed: readonly string[], excusing: ReadonlySet<string>): Option.Option<string> {
	const unused = listed.filter((folder) => !excusing.has(folder));
	if (unused.length === 0) {
		return Option.none();
	}
	return Option.some(
		[
			"oldFormFolders lists folders from which the browser bundle imports no old-form contract or operation file:",
			...unused.map((folder) => `  ${folder}`),
			"Remove each entry: the bundle check then covers its folder like the rest of the application.",
		].join("\n"),
	);
}
