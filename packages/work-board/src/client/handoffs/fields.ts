export function handoffFields(form: HTMLFormElement) {
	const recipient = form.elements.namedItem("recipient");
	const goal = form.elements.namedItem("goal");
	const constraints = form.elements.namedItem("constraints");
	const nextAction = form.elements.namedItem("nextAction");
	if (
		!(
			recipient instanceof HTMLInputElement
			&& goal instanceof HTMLTextAreaElement
			&& constraints instanceof HTMLTextAreaElement
			&& nextAction instanceof HTMLTextAreaElement
		)
	) {
		return undefined;
	}
	return { constraints, goal, nextAction, recipient };
}
