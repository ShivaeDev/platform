import { ciLogLines } from "#host/adapters/ciLogLines.ts";

export type JobLog =
	| { readonly name: string; readonly status: "unavailable" }
	| { readonly name: string; readonly status: "readable"; readonly text: string };

const DIGEST_LIMIT = 24_000;
const CUT = "\n[CI failure digest truncated; remaining output omitted.]";

function failures(lines: readonly string[]) {
	const tests = new Map<string, { lines: string[]; count: number }>();
	let current: string[] | undefined;
	for (const line of lines) {
		if (/^\s*FAIL\s+/u.test(line)) {
			const name = line.trim();
			const previous = tests.get(name);
			if (previous === undefined) {
				current = [name];
				tests.set(name, { count: 1, lines: current });
			} else {
				previous.count += 1;
				current = undefined;
			}
		} else if (/^\s*⎯/u.test(line)) {
			current = undefined;
		} else {
			current?.push(line);
		}
	}
	return [...tests.values()].map(({ count, lines: [title, ...body] }) =>
		[title, ...(count > 1 ? [`Occurrences: ${count} (${count - 1} ${count === 2 ? "repeat" : "repeats"})`] : []), body.join("\n").trim()]
			.join("\n")
			.trim(),
	);
}

export function ciFailureDigest(jobs: readonly JobLog[]) {
	const sections = jobs.map((job) => {
		if (job.status === "unavailable" || job.text.trim() === "") {
			return `Job: ${job.name}\nNo readable CI job logs are available.`;
		}
		const lines = ciLogLines(job.text);
		const tests = failures(lines);
		const clean = lines.filter((line) => !/^\s*⎯/u.test(line));
		const diagnostics = clean
			.slice(
				Math.max(
					0,
					clean.findIndex((line) => /error|fail/iu.test(line)),
				),
			)
			.join("\n")
			.trim();
		return `Job: ${job.name}\n${tests.length > 0 ? tests.join("\n\n") : diagnostics || "No failure details found in the readable job log."}`;
	});
	const digest = `CI failure logs (first failure per test):\n\n${sections.join("\n\n")}`;
	return digest.length > DIGEST_LIMIT ? `${digest.slice(0, DIGEST_LIMIT - CUT.length)}${CUT}` : digest;
}
