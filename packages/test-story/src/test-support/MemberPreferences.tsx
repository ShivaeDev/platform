import { useState } from "react";
import { createPortal } from "react-dom";
import type { MemberScreen } from "#memberScreens.ts";

export type DialogKind = "native" | "dialog" | "alertdialog";

export function MemberPreferences({ member, kind }: { readonly member: MemberScreen; readonly kind: DialogKind }) {
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
	const attributes = { "aria-label": `${member.name}'s preferences`, "data-owner": member.name };
	const dialog =
		kind === "native" ? (
			<dialog {...attributes} open>
				{contents}
			</dialog>
		) : (
			<section {...attributes} role={kind}>
				{contents}
			</section>
		);
	const portal = open ? createPortal(dialog, member.root) : null;
	return (
		<main>
			<button onClick={() => setOpen(true)} type="button">
				Preferences
			</button>
			<output>{saved ? "Saved" : "Unsaved"}</output>
			{portal}
		</main>
	);
}
