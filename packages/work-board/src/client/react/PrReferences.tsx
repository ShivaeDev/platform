import { type ReactNode, useContext } from "react";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";

const PULL_URL = /^(?<base>https?:\/\/[^/]+\/[^/]+\/[^/]+\/pull\/)\d+\/?$/u;
const REFERENCE = /\bPR #?(?<number>\d+)\b/gu;

function pullRequestBase(fleet: FleetItemsProjection | undefined) {
	if (fleet?.state !== "ready") {
		return undefined;
	}
	const bases = new Set([...fleet.items, ...fleet.completed].flatMap((item) => PULL_URL.exec(item.prUrl ?? "")?.groups?.base ?? []));
	return bases.size === 1 ? [...bases][0] : undefined;
}

export function PrReferences({ text }: { readonly text: string }) {
	const base = pullRequestBase(useContext(FleetItemsContext));
	if (!base) {
		return text;
	}
	const parts: ReactNode[] = [];
	let last = 0;
	for (const match of text.matchAll(REFERENCE)) {
		parts.push(text.slice(last, match.index));
		parts.push(
			<a className="underline underline-offset-4" href={`${base}${match.groups?.number}`} key={match.index}>
				{match[0]}
			</a>,
		);
		last = match.index + match[0].length;
	}
	parts.push(text.slice(last));
	return parts;
}
