import { use } from "react";

export function DraftSuspender({ attempts, pending }: { readonly attempts: string[]; readonly pending: Promise<void> }) {
	attempts.push("suspended");
	use(pending);
	return null;
}
