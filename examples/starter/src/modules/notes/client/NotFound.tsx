import { Link } from "@tanstack/react-router";

export function NotFound() {
	return (
		<main className="mx-auto max-w-md space-y-4 px-4 py-12">
			<h1>Note not found</h1>
			<p>This note is no longer available.</p>
			<Link className="underline" to="/">
				Back to notes
			</Link>
		</main>
	);
}
