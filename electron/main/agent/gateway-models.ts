import { z } from 'zod';
import { GatewayModel, type GatewayModel as GatewayModelType } from './shared-types';

const MODELS_URL = 'https://ai-gateway.vercel.sh/v1/models';
let cachedModels: Promise<GatewayModelType[]> | undefined;

const GatewayCatalog = z.object({ data: z.array(z.unknown()) });
const GatewayCatalogItem = z.object({
	id: z.string(),
	name: z.string().optional(),
	owned_by: z.string().optional(),
	type: z.string(),
}).passthrough();

export function parseGatewayModels(payload: unknown): GatewayModelType[] {
	const catalog = GatewayCatalog.safeParse(payload);
	if (!catalog.success) {
		throw new Error('AI Gateway returned an invalid model catalog.');
	}

	const seen = new Set<string>();
	const models: GatewayModelType[] = [];
	for (const candidate of catalog.data.data) {
		const parsed = GatewayCatalogItem.safeParse(candidate);
		if (!parsed.success) continue;
		const value = parsed.data;
		if (value.type !== 'language' || seen.has(value.id)) continue;
		seen.add(value.id);
		models.push(GatewayModel.parse({
			id: value.id,
			name: value.name ?? value.id.split('/').pop() ?? value.id,
			provider: value.owned_by ?? value.id.split('/')[0],
		}));
	}

	return models.sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name));
}

export function getGatewayModels(): Promise<GatewayModelType[]> {
	if (cachedModels) return cachedModels;
	const request = fetch(MODELS_URL)
		.then(async response => {
			if (!response.ok) throw new Error(`AI Gateway model catalog failed (${response.status}).`);
			return parseGatewayModels(await response.json());
		});
	cachedModels = request;
	return request.catch(error => {
		if (cachedModels === request) cachedModels = undefined;
		throw error;
	});
}
