export type GatewayModel = {
	id: string;
	name: string;
	provider: string;
};

export type ReasoningProgress = {
	id: number;
	text: string;
};

export type ToolProgress<TSummary = unknown> = {
	id: string;
	name: string;
	status: 'running' | 'done' | 'error';
	args?: Record<string, unknown>;
	summary?: TSummary;
	error?: string;
};
