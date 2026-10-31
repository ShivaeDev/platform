import { type ReactNode, useState } from "react";
import { createPortal } from "react-dom";

const AUTH_URL = "https://identity.test/authorize?client=screen";

export function WaitPage({ duplicate = false, disabled = false }: { readonly duplicate?: boolean; readonly disabled?: boolean }) {
	const [notice, setNotice] = useState("visible");
	const [ready, setReady] = useState(false);
	const [open, setOpen] = useState(false);
	const [plan, setPlan] = useState("free");
	const [saved, setSaved] = useState("Unsaved");
	let dialog: ReactNode = null;
	if (open) {
		dialog = createPortal(
			<section aria-label="Preferences" role="dialog">
				<form
					aria-label="Preferences form"
					onSubmit={(event) => {
						event.preventDefault();
						setSaved(`${new FormData(event.currentTarget).get("city")}: ${plan}`);
					}}
				>
					<input aria-label="City" name="city" />
					<select aria-label="Plan" disabled={disabled} onChange={(event) => setPlan(event.currentTarget.value)} value={plan}>
						<option value="free">Free</option>
						<option value="team">Team</option>
					</select>
					<output aria-label="Chosen plan">{plan}</output>
					<button type="submit">Apply</button>
				</form>
				<button onClick={() => setOpen(false)} type="button">
					Close
				</button>
			</section>,
			document.body,
		);
	}
	let message: ReactNode = null;
	if (notice !== "removed") {
		message = (
			<p className="notice" hidden={notice === "hidden"}>
				Working
			</p>
		);
	}
	let result: ReactNode = null;
	if (ready) {
		result = (
			<section>
				<p className="ready">
					Ready <em>now</em>
				</p>
				<div role="alert">
					Account <strong>saved</strong>
				</div>
			</section>
		);
	}
	let twin: ReactNode = null;
	if (duplicate) {
		twin = <p>Ready now</p>;
	}
	return (
		<main>
			{message}
			<p hidden>Ready now</p>
			{result}
			{twin}
			<button onClick={() => setNotice("removed")} type="button">
				Dismiss
			</button>
			<button onClick={() => setNotice("hidden")} type="button">
				Hide
			</button>
			<button onClick={() => setReady(true)} type="button">
				Reveal
			</button>
			<button onClick={() => setOpen(true)} type="button">
				Preferences
			</button>
			<button
				onClick={() => {
					window.location.href = "/inside";
				}}
				type="button"
			>
				Internal page
			</button>
			<button onClick={() => window.location.assign(AUTH_URL)} type="button">
				Sign in
			</button>
			<output aria-label="Saved preferences">{saved}</output>
			{dialog}
		</main>
	);
}
