import { Deferred, Effect, SubscriptionRef } from "effect";
import { useState } from "react";
import { ActivityPageView } from "#test/activityPageView.ts";
import type { createSettlingApp } from "#test/createSettlingApp.ts";

type App = Effect.Success<ReturnType<typeof createSettlingApp>>;

export function SettlingApp({ app }: { readonly app: App }) {
	const [preview, setPreview] = useState("No preview");
	const [attachment, setAttachment] = useState("No attachment");
	function handlePreview() {
		Effect.runSync(SubscriptionRef.set(app.pending, true));
		void Effect.runPromise(Deferred.await(app.preview)).then(() => {
			setPreview("Preview ready");
			Effect.runSync(SubscriptionRef.set(app.pending, false));
			Effect.runSync(Deferred.succeed(app.previewed, undefined));
		});
	}
	function loadAttachment(prepare: boolean) {
		void fetch("/attachment")
			.then((response) => {
				if (prepare) {
					handlePreview();
				}
				return response.text();
			})
			.then((text) => {
				setAttachment(text);
				Effect.runSync(Deferred.succeed(app.attached, undefined));
			});
	}
	return (
		<>
			<ActivityPageView client={app.client} />
			<button onClick={handlePreview} type="button">
				Prepare preview
			</button>
			<p data-preview>{preview}</p>
			<button onClick={() => loadAttachment(false)} type="button">
				Load attachment
			</button>
			<button onClick={() => loadAttachment(true)} type="button">
				Load attachment and prepare preview
			</button>
			<p data-attachment>{attachment}</p>
		</>
	);
}
