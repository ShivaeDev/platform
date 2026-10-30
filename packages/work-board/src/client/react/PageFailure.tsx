import { Schema } from "effect";
import { RpcClientError } from "effect/rpc/RpcClientError";
import { SocketErrorReason } from "effect/socket/Socket";
import { CircleAlert, Unplug } from "lucide-react";
import { Button } from "#client/react/components/ui/button.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "#client/react/components/ui/empty.tsx";
import { EmptyState } from "#client/react/EmptyState.tsx";
import { LinkButton } from "#client/react/LinkButton.tsx";
import { pageFailureReason } from "#client/react/pageFailureReason.ts";

export function PageFailure({ failure, onRetry, retrying }: { readonly failure: unknown; readonly onRetry: () => void; readonly retrying: boolean }) {
	const unreachable = serverUnreachable(failure);
	return (
		<Empty className="mx-auto mt-8 max-w-xl border">
			<EmptyHeader role="status">
				<EmptyMedia variant="icon">{unreachable ? <Unplug /> : <CircleAlert />}</EmptyMedia>
				<EmptyTitle>{unreachable ? "The Board server isn't answering" : "This page couldn't be opened"}</EmptyTitle>
				<EmptyDescription>
					{unreachable && "This page tries again on its own. "}
					{pageFailureReason(failure)}
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent className="flex-row justify-center">
				<Button aria-disabled={retrying} onClick={retrying ? undefined : onRetry} size="sm" type="button" variant="outline">
					{retrying ? "Retrying…" : "Retry"}
				</Button>
				{!unreachable && <LinkButton href="/_board/system">Open System</LinkButton>}
			</EmptyContent>
		</Empty>
	);
}

function serverUnreachable(failure: unknown) {
	return (
		failure instanceof RpcClientError
		&& (Schema.is(SocketErrorReason)(failure.reason) || (failure.reason._tag === "HttpError" && failure.reason.kind === "TransportError"))
	);
}

export function ProjectionFailure({
	conflict,
	failure,
	missing,
	cause,
	onRetry,
	retrying,
}: {
	readonly conflict: boolean;
	readonly failure: { readonly _tag: string; readonly message: string } | undefined;
	readonly missing: boolean;
	readonly cause: unknown;
	readonly onRetry: () => void;
	readonly retrying: boolean;
}) {
	if (missing || conflict) {
		return (
			<EmptyState action={<LinkButton href="/">Back to Today</LinkButton>} title={missing ? "Not found" : "Can't show this page"}>
				{failure?.message}
			</EmptyState>
		);
	}
	return <PageFailure failure={cause} onRetry={onRetry} retrying={retrying} />;
}
