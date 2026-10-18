import { WorkCard } from "#client/react/WorkCard.tsx";
import { nowWork } from "./nowWork.ts";
import { componentScreen } from "./screenTraits.ts";

export function orchestratorWorkCard() {
	const data = nowWork(1);
	const item = data.rows[0];
	if (!item) {
		throw new Error("Missing work fixture");
	}
	const fleet = {
		attentionOwner: "orchestrator" as const,
		document: null,
		stage: "executing" as const,
		stageEnteredAt: null,
		updatedAt: null,
		workId: item.id,
	};
	return componentScreen(<WorkCard fleet={fleet} item={item} state={data.state} />);
}
