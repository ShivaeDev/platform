import { Component, type ReactNode } from "react";

export function BrokenScreen({ failure }: { readonly failure: Error }): ReactNode {
	throw failure;
}

export class FailureBoundary extends Component<{ readonly children: ReactNode; readonly warning?: boolean }, { readonly failure: Error | null }> {
	override state: { readonly failure: Error | null } = { failure: null };
	override componentDidCatch(failure: Error) {
		this.setState({ failure });
	}
	override render() {
		if (this.state.failure === null) {
			return this.props.children;
		}
		const warning = this.props.warning ? <input value="Uneditable screen field" /> : null;
		return (
			<section>
				<p role="alert">{this.state.failure.message}</p>
				{warning}
			</section>
		);
	}
}
