export function TodayHiddenDraft({ href, text }: { readonly href: string; readonly text: string }) {
	return text ? (
		<p className="text-muted-foreground m-0 text-xs" data-hidden-draft="">
			{text}{" "}
			<a className="hover:text-foreground underline underline-offset-4" href={href}>
				Review it on the item page
			</a>
		</p>
	) : null;
}
