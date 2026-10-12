const bound = new WeakSet<HTMLButtonElement>();
export function copyPrompts(root: ParentNode) {
	for (const button of root.querySelectorAll<HTMLButtonElement>("[data-handoff-copy]")) {
		if (bound.has(button)) {
			continue;
		}
		bound.add(button);
		button.addEventListener("click", async () => {
			const field = document.getElementById(button.dataset.handoffCopy ?? "");
			const status = button.parentElement?.querySelector("[data-copy-status]");
			if (!(field instanceof HTMLTextAreaElement && status)) {
				return;
			}
			try {
				await navigator.clipboard.writeText(field.value);
				status.textContent = "Prompt copied. Paste it into your existing agent session.";
			} catch {
				field.focus();
				field.select();
				status.textContent = "Clipboard unavailable. The prompt is selected; copy it manually.";
			}
		});
	}
}
export function preparedPrompt(container: HTMLElement, id: string, prompt: string) {
	const label = document.createElement("label");
	label.textContent = "Prompt for your existing agent session";
	const field = document.createElement("textarea");
	field.id = `handoff-prompt-${id}`;
	field.readOnly = true;
	field.rows = 3;
	field.value = prompt;
	label.append(field);
	const button = document.createElement("button");
	button.type = "button";
	button.dataset.handoffCopy = field.id;
	button.textContent = "Copy tiny prompt";
	const status = document.createElement("p");
	status.dataset.copyStatus = "";
	status.setAttribute("role", "status");
	status.textContent = "Prepared; receipt not confirmed. Copy the prompt to your agent.";
	container.replaceChildren(label, button, status);
	container.hidden = false;
	copyPrompts(container);
}
