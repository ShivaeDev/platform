import { useState } from "react";
import { Button, buttonVariants } from "#client/react/components/ui/button.tsx";
import { Input } from "#client/react/components/ui/input.tsx";
import { Label } from "#client/react/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#client/react/components/ui/select.tsx";
import { useSavedViews } from "#client/react/useSavedViews.ts";
import { shellIds } from "./shellIds.ts";

export function SavedViews({ url }: { readonly url: string }) {
	const views = useSavedViews();
	const [name, setName] = useState("");
	const chosen = views.views.find((view) => view.name === views.selected);
	const items = [
		{ label: views.views.length > 0 ? "Choose a saved view" : "No saved views", value: "" },
		...views.views.map((view) => ({ label: view.name, value: view.name })),
	];
	return (
		<section aria-label="Saved local views" className="grid gap-2" data-url={url} id={shellIds.savedWorkViews}>
			<div className="flex flex-wrap items-center gap-2">
				<form
					className="flex items-center gap-2"
					id={shellIds.saveWorkView}
					onSubmit={(event) => {
						event.preventDefault();
						const field = event.currentTarget.querySelector("input");
						views.save((field?.value ?? name).trim().slice(0, 60), url);
					}}
				>
					<Label className="sr-only" htmlFor={shellIds.viewName}>
						View name
					</Label>
					<Input
						className="w-44"
						id={shellIds.viewName}
						maxLength={60}
						onInput={(event) => setName(event.currentTarget.value)}
						placeholder="Name this view"
						required
						value={name}
					/>
					<Button size="sm" type="submit" variant="outline">
						Save view
					</Button>
				</form>
				<Label className="sr-only" htmlFor={shellIds.savedView}>
					Saved views
				</Label>
				<SavedViewSelect disabled={views.views.length === 0} items={items} onChoose={views.select} value={views.selected} />
				<a className={buttonVariants({ size: "sm", variant: "outline" })} hidden={!chosen} href={chosen?.url} id={shellIds.openSavedView}>
					Open
				</a>
				<Button disabled={!chosen} id={shellIds.removeSavedView} onClick={views.remove} size="sm" type="button" variant="ghost">
					Remove
				</Button>
				<Button disabled={views.views.length === 0} id={shellIds.clearSavedViews} onClick={views.clear} size="sm" type="button" variant="ghost">
					Clear all
				</Button>
			</div>
			<p className="m-0 text-muted-foreground text-xs" id={shellIds.savedViewStatus} role="status">
				{views.notice
					|| "Save board, filters, sort, and layout locally. Up to 10 named views; saving the same name updates it. Item selection stays in the URL."}
			</p>
		</section>
	);
}

function SavedViewSelect({
	disabled,
	items,
	value,
	onChoose,
}: {
	readonly disabled: boolean;
	readonly items: readonly { readonly label: string; readonly value: string }[];
	readonly value: string;
	readonly onChoose: (name: string) => void;
}) {
	return (
		<Select disabled={disabled} items={items} onValueChange={(next) => onChoose(next ?? "")} value={value}>
			<SelectTrigger className="max-w-full" id={shellIds.savedView}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{items.map((item) => (
					<SelectItem key={item.value} value={item.value}>
						{item.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
