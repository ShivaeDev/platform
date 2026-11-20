import { inAdaptersOrTestSupport } from "#naming/unsafeFolders.ts";
import type { Finding } from "#rule.ts";

export function permitted(finding: Finding): boolean {
	return finding.evidenceOnly === true || (finding.unsafe === true && inAdaptersOrTestSupport(finding.file));
}

export function reported<TFinding extends Finding>({
	evidenceOnly: _evidenceOnly,
	unsafe: _unsafe,
	...finding
}: TFinding): Omit<TFinding, "evidenceOnly" | "unsafe"> {
	return finding;
}
