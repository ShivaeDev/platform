import { useAtomValue } from "@effect/atom-react";
import { useMemo } from "react";
import { activeRead } from "#client/react/activeRead.ts";
import type { ShellApi } from "#client/react/ShellApi.ts";

export function PageHealth({ api }: { readonly api: ShellApi }) {
	const atom = useMemo(() => activeRead(api, "today", "/"), [api]);
	const state = useAtomValue(atom);
	let status = "settled";
	if (state.pending) {
		status = "pending";
	}
	if (state.failed) {
		status = "failed";
	}
	return <output aria-label="Page health">{status}</output>;
}
