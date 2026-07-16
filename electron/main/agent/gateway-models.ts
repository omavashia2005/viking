import type { GatewayModel } from './code/shared-types';

const MODELS_URL = 'https://ai-gateway.vercel.sh/v1/models';
let cachedModels: Promise<GatewayModel[]> | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function parseGatewayModels(payload: unknown): GatewayModel[] {
	if (!isRecord(payload) || !Array.isArray(payload.data)) {
		throw new Error('AI Gateway returned an invalid model catalog.');
	}

	const seen = new Set<string>();
	const models: GatewayModel[] = [];
	for (const value of payload.data) {
		if (!isRecord(value) || value.type !== 'language' || typeof value.id !== 'string' || seen.has(value.id)) continue;
		seen.add(value.id);
		const provider = typeof value.owned_by === 'string' ? value.owned_by : value.id.split('/')[0];
		const name = typeof value.name === 'string' ? value.name : value.id.split('/').pop() ?? value.id;
		models.push({ id: value.id, name, provider });
	}

	return models.sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name));
}

export function getGatewayModels(): Promise<GatewayModel[]> {
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
