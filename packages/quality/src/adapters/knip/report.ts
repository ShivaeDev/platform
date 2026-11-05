import type { Findings } from "#rule.ts";
import { knipFindings } from "./findings.ts";

export function knipReport(stdout: string, stderr: string, code: number): Findings {
	let report: Findings;
	let failure: string;
	try {
		report = knipFindings(stdout);
		if (code === (report.length > 0 ? 1 : 0)) {
			return report;
		}
		failure = `knip exited ${code} inconsistently with its report:\n${stderr || stdout}`;
	} catch {
		failure = `knip exited ${code} without a valid report:\n${stderr || stdout || "No output."}`;
	}
	return [
		{
			file: "package.json",
			message: `Unused-code analysis did not complete. Repair the tool configuration or command failure and rerun quality lint. ${failure}`,
		},
	];
}
