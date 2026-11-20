import { inAdaptersOrTestSupport } from "#naming/unsafeFolders.ts";
import type { Finding } from "#rule.ts";

export function permitted(finding: Finding): boolean {
	return finding.unsafe === true && inAdaptersOrTestSupport(finding.file);
}

export function reported<TFinding extends Finding>({ unsafe: _unsafe, ...finding }: TFinding): Omit<TFinding, "unsafe"> {
	return finding;
}
