import { type ReactNode, useContext } from "react";
import { type TextToken, textTokens } from "#browser/document/mentions.ts";
import type { Document } from "#browser/document/schema.ts";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { StatusChip } from "./StatusChip.tsx";

const PULL_URL = /^(?<base>https?:\/\/[^/]+\/[^/]+\/[^/]+\/pull\/)\d+\/?$/u;
const LINK = "underline underline-offset-4";

function fleetPulls(fleet: FleetItemsProjection | undefined) {
	if (fleet?.state !== "ready") {
		return undefined;
	}
	const bases = new Set([...fleet.items, ...fleet.completed].flatMap((item) => PULL_URL.exec(item.prUrl ?? "")?.groups?.base ?? []));
	return bases.size === 1 ? [...bases][0] : undefined;
}

function tokenLink(token: TextToken, document: Document, pulls: string | undefined): ReactNode {
	if (token.kind === "pull") {
		return pulls ? (
			<a className={LINK} href={`${pulls}${token.value}`} key={token.index}>
				{token.text}
			</a>
		) : undefined;
	}
	const href = document.references[token.value];
	const details = document.referenceDetails?.[token.value];
	return href && details ? (
		<span className="inline-flex flex-wrap items-baseline gap-1" data-mention={token.value} key={token.index}>
			<a className={LINK} href={href} title={token.value}>
				{details.title}
			</a>
			<StatusChip className="self-center" status={details.status} />
		</span>
	) : undefined;
}

export function ActionText({ document, text }: { readonly document: Document; readonly text: string }) {
	const fleet = useContext(FleetItemsContext);
	const pulls = document.pullRequests ?? fleetPulls(fleet);
	const parts: ReactNode[] = [];
	let last = 0;
	for (const token of textTokens(text)) {
		const link = tokenLink(token, document, pulls);
		if (link !== undefined) {
			parts.push(text.slice(last, token.index), link);
			last = token.index + token.text.length;
		}
	}
	parts.push(text.slice(last));
	return parts;
}
