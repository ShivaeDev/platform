import { useCallback, useState } from "react";
import { authorLabel } from "#client/responses/authorLabel.ts";

export function useResponseAuthor() {
	const [label] = useState(() =>
		authorLabel(() => window.localStorage, typeof document === "undefined" ? undefined : document.documentElement.dataset.workspace),
	);
	return useCallback(() => label.read("") || "maintainer", [label]);
}
