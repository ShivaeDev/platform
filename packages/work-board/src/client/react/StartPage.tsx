import { Copy } from "lucide-react";
import { useRef, useState } from "react";
import type { StartProjection } from "#browser/views/remaining.ts";
import { Button } from "#client/react/components/ui/button.tsx";
import { copyText } from "./copyText.ts";
import { PageHeader } from "./PageHeader.tsx";
import { ReadingPanel } from "./ReadingPanel.tsx";
import { SectionCard } from "./SectionCard.tsx";

type Template = StartProjection["templates"][number];

export function StartPage({ data }: { readonly data: StartProjection }) {
	return (
		<ReadingPanel>
			<PageHeader
				summary="The Board shows the Markdown files in this folder and never writes them for you. Copy a template, save it with your editor, and it shows up here."
				title={data.empty ? "Start your workspace" : "Templates"}
			/>
			<SectionCard title="How to start">
				<ol className="m-0 list-decimal space-y-2 pl-5">
					<li>Copy a template below.</li>
					<li>Save it in this folder under the suggested name.</li>
					<li>Change the example IDs to your own, and update the links that use them.</li>
					<li>Fill in the real details. Start with the project, then the investigation and the result.</li>
				</ol>
				<p className="m-0 text-muted-foreground">
					Only record evidence for checks you actually ran. A finished agent run isn't proof on its own. Plain Markdown without frontmatter works too.
				</p>
			</SectionCard>
			<div className="grid gap-4 lg:grid-cols-2">
				{data.templates.map((template) => (
					<StartTemplate key={template.file} template={template} />
				))}
			</div>
		</ReadingPanel>
	);
}

function StartTemplate({ template }: { readonly template: Template }) {
	const detailsRef = useRef<HTMLDetailsElement>(null);
	const fieldRef = useRef<HTMLTextAreaElement>(null);
	const [status, setStatus] = useState("");
	async function handleCopy() {
		if (await copyText(template.source)) {
			setStatus(`Copied. Save it as ${template.file}.`);
			return;
		}
		if (detailsRef.current) {
			detailsRef.current.open = true;
		}
		fieldRef.current?.focus();
		fieldRef.current?.select();
		setStatus("Couldn't copy automatically. The template is selected, so copy it yourself.");
	}
	return (
		<SectionCard
			action={
				<Button
					aria-label={`Copy ${template.label.toLowerCase()} template`}
					data-template-copy={template.file}
					onClick={handleCopy}
					type="button"
					variant="outline"
				>
					<Copy aria-hidden="true" data-icon="inline-start" />
					Copy
				</Button>
			}
			className="start-template"
			description={
				<>
					Save as <code>{template.file}</code>
				</>
			}
			title={template.label}
		>
			<p className={status ? "m-0 text-muted-foreground text-xs" : "sr-only"} data-copy-status role="status">
				{status}
			</p>
			<details className="rounded-md border px-3 py-2" data-key={`template:${template.file}`} ref={detailsRef}>
				<summary className="cursor-pointer font-medium">Show template</summary>
				<label className="sr-only" htmlFor={`template-${template.file}`}>
					{template.label} template
				</label>
				<textarea
					className="mt-2 w-full rounded-md border bg-muted p-3 font-mono text-xs"
					defaultValue={template.source}
					id={`template-${template.file}`}
					readOnly
					ref={fieldRef}
					rows={16}
					spellCheck={false}
				/>
			</details>
		</SectionCard>
	);
}
