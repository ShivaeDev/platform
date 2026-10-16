import { useState } from "react";
import { useSavedViews } from "#client/react/useSavedViews.ts";
import { shellIds } from "./shellIds.ts";

export function SavedViews({ url }: { readonly url: string }) {
	const views = useSavedViews();
	const [name, setName] = useState("");
	const chosen = views.views.find((view) => view.name === views.selected);
	return (
		<section aria-label="Saved local views" className="saved-work-views" data-url={url} id={shellIds.savedWorkViews}>
			<form
				id={shellIds.saveWorkView}
				onSubmit={(event) => {
					event.preventDefault();
					const field = event.currentTarget.querySelector("input");
					views.save((field?.value ?? name).trim().slice(0, 60), url);
				}}
			>
				<label htmlFor="view-name">View name</label>
				<input
					id={shellIds.viewName}
					maxLength={60}
					onInput={(event) => setName(event.currentTarget.value)}
					placeholder="Name this view"
					required
					value={name}
				/>
				<button type="submit">Save view</button>
			</form>
			<div className="view-picker">
				<label htmlFor="saved-view">Saved views</label>
				<select
					disabled={views.views.length === 0}
					id={shellIds.savedView}
					onChange={(event) => views.select(event.target.value)}
					value={views.selected}
				>
					<option value="">{views.views.length > 0 ? "Choose a saved view" : "No saved views"}</option>
					{views.views.map((view) => (
						<option key={view.name} value={view.name}>
							{view.name}
						</option>
					))}
				</select>
				<a hidden={!chosen} href={chosen?.url} id={shellIds.openSavedView}>
					Open
				</a>
				<button disabled={!chosen} id={shellIds.removeSavedView} onClick={views.remove} type="button">
					Remove
				</button>
				<button disabled={views.views.length === 0} id={shellIds.clearSavedViews} onClick={views.clear} type="button">
					Clear all
				</button>
			</div>
			<p id={shellIds.savedViewStatus} role="status">
				{views.notice
					|| "Save board, filters, sort, and layout locally. Up to 10 named views; saving the same name updates it. Item selection stays in the URL."}
			</p>
		</section>
	);
}
