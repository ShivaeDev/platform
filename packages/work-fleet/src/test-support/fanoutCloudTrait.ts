import { configureFanoutCloud } from "#test/fanoutCloud.ts";
import { host } from "#test/hostStory.ts";

export function fanoutCloudTrait(count: number) {
	return host.trait("configuration", `${count} Cloud workers lose turn acknowledgements and turn reads stay unavailable until restart`, (engine) => {
		configureFanoutCloud(engine, count);
	});
}
