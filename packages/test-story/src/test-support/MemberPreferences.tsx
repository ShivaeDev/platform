import { useState } from "react";
import { createPortal } from "react-dom";
import type { MemberScreen } from "#memberScreens.ts";

export type DialogKind = "native" | "dialog" | "alertdialog";
export type PortalTarget = "member" | "body";

export function MemberPreferences({
	member,
	kind,
	portalTarget,
}: {
	readonly member: MemberScreen;
	readonly kind: DialogKind;
	readonly portalTarget: PortalTarget;
}) {
	const [open, setOpen] = useState(false);
	const [saved, setSaved] = useState(false);
	const contents = (
		<>
			<p>{member.name}'s private preferences</p>
			<button onClick={() => setSaved(true)} type="button">
				Confirm
			</button>
			<button onClick={() => setOpen(false)} type="button">
				Dismiss {member.name}
			</button>
		</>
	);
	const id = `${member.name}-preferences`;
	const attributes = { "aria-label": portalTarget === "body" ? "Preferences" : `${member.name}'s preferences`, "data-owner": member.name, id };
	const dialog =
		kind === "native" ? (
			<dialog {...attributes} open={open}>
				{contents}
			</dialog>
		) : (
			<section {...attributes} role={kind}>
				{contents}
			</section>
		);
	const portal = open || kind === "native" ? createPortal(dialog, portalTarget === "body" ? document.body : member.root) : null;
	return (
		<main>
			<button aria-controls={id} onClick={() => setOpen(true)} type="button">
				Preferences
			</button>
			<output>{saved ? "Saved" : "Unsaved"}</output>
			{portal}
		</main>
	);
}
