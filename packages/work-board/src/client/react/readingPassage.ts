const MISSING_PASSAGE = "This passage is no longer in the document.";

export function revealPassage(hash: string) {
	const target = passageTarget(hash);
	for (let parent = target?.parentElement; parent; parent = parent.parentElement) {
		if (parent instanceof HTMLDetailsElement) {
			parent.open = true;
		}
		if (parent.matches('[role="tabpanel"][hidden]')) {
			document.getElementById(parent.getAttribute("aria-labelledby") ?? "")?.click();
		}
	}
}
export function scrollToPassage(hash: string) {
	if (!hash) {
		window.scrollTo(0, 0);
		return "";
	}
	const target = passageTarget(hash);
	if (!target) {
		return MISSING_PASSAGE;
	}
	if (!target.matches('[id^="answer-card-"]')) {
		target.scrollIntoView();
		target.focus({ preventScroll: true });
		return "";
	}
	const header = target.closest(".document-layout")?.querySelector(".item-introduction");
	target.style.scrollMarginTop = `calc(var(--board-header-height, 0px) + ${(header?.getBoundingClientRect().height ?? 0) + 16}px)`;
	target.scrollIntoView();
	const control = answerControl(target);
	if (control) {
		control.focus();
	} else {
		target.focus({ preventScroll: true });
	}
	return "";
}
function answerControl(card: HTMLElement) {
	const active = document.activeElement;
	if (active instanceof HTMLElement && card.contains(active) && active.matches("[data-response-form] :is(textarea, input, [data-choice])")) {
		return active;
	}
	return [...card.querySelectorAll<HTMLElement>("[data-response-form] :is([data-choice]:not([tabindex='-1']), textarea)")].find(
		(control) => !(control.closest("details:not([open])") || control.matches(":disabled, [aria-disabled='true']")),
	);
}
export function passageStatus(hash: string) {
	return !hash || passageTarget(hash) ? "" : MISSING_PASSAGE;
}
function passageTarget(hash: string) {
	try {
		return document.getElementById(decodeURIComponent(hash.slice(1)));
	} catch {
		return null;
	}
}
