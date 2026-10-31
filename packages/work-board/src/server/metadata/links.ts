import type { MetadataModel } from "#integration/metadata.ts";
import { referenceProblem } from "./problems.ts";

export function identityUrl(id: string): string {
	return `/_board/item/${encodeURIComponent(id)}/`;
}
export function referenceTarget(reference: string, model: MetadataModel): string | undefined {
	if (model.unavailable.length > 0) {
		return undefined;
	}
	const [id = "", criterion] = reference.split("#");
	if (referenceProblem(reference, model.ids, model.settled)) {
		return undefined;
	}
	return identityUrl(id) + (criterion ? `#criterion-${encodeURIComponent(criterion)}` : "");
}
