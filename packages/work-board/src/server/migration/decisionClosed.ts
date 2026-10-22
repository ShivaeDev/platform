import { isMap, isSeq } from "yaml";
import type { sourceHeader } from "./sourceHeader.ts";

export function decisionClosed(header: NonNullable<ReturnType<typeof sourceHeader>>) {
	const requests = header.doc.get("attention", true);
	return isSeq(requests) && requests.items.length > 0
		? requests.items.every((request) => isMap(request) && request.get("state") === "closed")
		: undefined;
}
