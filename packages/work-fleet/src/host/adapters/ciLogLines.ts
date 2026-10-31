import { stripVTControlCharacters } from "node:util";

export function ciLogLines(text: string) {
	return stripVTControlCharacters(text)
		.split(/\r?\n/u)
		.map((line) =>
			line
				.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z ?/u, "")
				.replace(/^##\[error\]/u, "")
				.trimEnd(),
		)
		.filter(
			(line) =>
				!/^\s*(?:##\[|Test Files\s|Tests\s|Start at\s|Duration\s|RUN\s+v|✓|×|❯.*\(\d+ tests?\)|Progress:|Error: Process completed with exit code|ELIFECYCLE)/u.test(
					line,
				),
		);
}
