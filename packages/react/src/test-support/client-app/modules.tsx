import { clientModule } from "#client/module.ts";
import { Counter, Profile } from "#test/client-app/backend.ts";
import { BumpButton, CountView, ViewerView } from "#test/client-app/views.tsx";

export function slotModule(name: string) {
	return clientModule({}, () => ({
		footer: <p>{name} footer</p>,
		menu: [
			<a href={`#${name}`} key="menu">
				{name} menu
			</a>,
			<a href={`#${name}-second`} key="second">
				{name} second menu
			</a>,
		],
		overlays: [<aside key="overlay">{name} overlay</aside>],
	}));
}

// Each module names the counter under its own key, as two independent modules would.
export const tallyModule = clientModule({ tally: Counter }, ({ tally }) => {
	const bump = tally.bump.runtime.fn(tally.bump.run);
	return { menu: [<CountView counter={tally} key="tally" name="Tally" />, <BumpButton bump={bump} key="bump" />] };
});

export const summaryModule = clientModule({ total: Counter }, ({ total }) => ({
	menu: [<CountView counter={total} key="summary" name="Summary" />],
}));

export const profileModule = clientModule({ profile: Profile }, ({ profile }) => ({
	menu: [<ViewerView key="viewer" profile={profile} />],
}));
