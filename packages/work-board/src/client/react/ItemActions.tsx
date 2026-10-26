import type { Document } from "#browser/document/schema.ts";
import { closedStatus } from "#browser/views/workStatus.ts";
import { Favorite } from "./Favorite.tsx";
import { LinkButton } from "./LinkButton.tsx";

const TOUCH = "pointer-coarse:h-11";

export function ItemActions({ document }: { readonly document: Document }) {
	const kind = document.metadata.kind ?? "";
	const identity = document.identity;
	return (
		<>
			<Favorite file={document.file} title={document.file} />
			{identity
				&& !(
					kind === "question"
					|| document.metadata.response
					|| document.metadata.handoff
					|| kind === "goal"
					|| (kind !== "report" && closedStatus(document.metadata.status))
				) && (
					<LinkButton className={TOUCH} href={`/_board/handoff?item=${encodeURIComponent(identity)}`}>
						Prepare an agent handoff
					</LinkButton>
				)}
			{identity && document.metadata.items !== undefined && (
				<LinkButton className={TOUCH} href={`/_board/work?view=board&board=${encodeURIComponent(identity)}`}>
					View this board
				</LinkButton>
			)}
		</>
	);
}
