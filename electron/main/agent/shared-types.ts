import { z } from 'zod';

export const GatewayModel = z.object({
	id: z.string(),
	name: z.string(),
	provider: z.string(),
});
export type GatewayModel = z.infer<typeof GatewayModel>;

export const ReasoningProgress = z.object({
	id: z.number().int().nonnegative(),
	text: z.string(),
});
export type ReasoningProgress = z.infer<typeof ReasoningProgress>;

export const ToolProgress = z.object({
	id: z.string(),
	name: z.string(),
	status: z.enum(['running', 'done', 'error']),
	args: z.record(z.unknown()).optional(),
	summary: z.unknown().optional(),
	error: z.string().optional(),
});
export type ToolProgress = z.infer<typeof ToolProgress>;
