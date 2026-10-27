import { useId, useState } from "react";
import { Button } from "#client/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "#client/ui/dialog.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#client/ui/select.tsx";
import { Textarea } from "#client/ui/textarea.tsx";

export function FormPrimitivesScreen() {
	const [saved, setSaved] = useState("");
	const summaryId = useId();
	return (
		<>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					const values = new FormData(event.currentTarget);
					setSaved(`${values.get("summary")} (${values.get("status")})`);
				}}
			>
				<label htmlFor={summaryId}>Summary</label>
				<Textarea id={summaryId} name="summary" />
				<Select defaultValue="draft" items={{ draft: "Draft", published: "Published" }} name="status">
					<SelectTrigger aria-label="Status">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="draft">Draft</SelectItem>
						<SelectItem value="published">Published</SelectItem>
					</SelectContent>
				</Select>
				<Button type="submit">Save</Button>
				<output aria-label="Saved summary">{saved}</output>
			</form>
			<Dialog>
				<DialogTrigger render={<Button />}>Details</DialogTrigger>
				<DialogContent>
					<DialogTitle>Form details</DialogTitle>
					<DialogDescription>Choose a status and write a summary.</DialogDescription>
				</DialogContent>
			</Dialog>
		</>
	);
}
