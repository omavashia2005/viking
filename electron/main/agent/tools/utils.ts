import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { tool, type FlexibleSchema, type Tool } from 'ai';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../../config';

export const ToolArguments = z.record(z.unknown());
export type ToolArguments = z.infer<typeof ToolArguments>;
export const ToolContext = z.object({ cwd: z.string() });
export type ToolContext = z.infer<typeof ToolContext>;
// @compile-time-only: registry entries contain executable callbacks and never cross a runtime boundary.
export type RegisteredTool = {
	name: string;
	description: string;
	inputSchema: FlexibleSchema<ToolArguments>;
	run(args: ToolArguments, context: ToolContext): unknown | Promise<unknown>;
};
const McpServerSpec = z.object({ command: z.string(), args: z.array(z.string()) });
type McpServerSpec = z.infer<typeof McpServerSpec>;
export type McpServer = 'fff' | 'context7';
const McpToolContent = z.object({ type: z.string(), text: z.string().optional() }).passthrough();
type McpToolContent = z.infer<typeof McpToolContent>;
type BuiltTool = Tool<ToolArguments, unknown>;

export type McpConnectionPool = Map<string, Promise<Client>>;
export const mcpConnectionPool: McpConnectionPool = new Map();

async function openMcp(spec: McpServerSpec, warmupMs = 0): Promise<Client> {
	spec = McpServerSpec.parse(spec);
	const client = new Client({ name: 'viking', version: '0.1.0' });
	try {
		await client.connect(new StdioClientTransport({ command: spec.command, args: spec.args }));
		if (warmupMs) await new Promise(resolve => setTimeout(resolve, warmupMs));
		return client;
	} catch (error) {
		await client.close().catch(() => undefined);
		throw error;
	}
}

export function getMcpConnection(server: McpServer, cwd: string): Promise<Client> {
	const key = server === 'fff' ? `fff:${path.resolve(cwd)}` : server;
	const existing = mcpConnectionPool.get(key);
	if (existing) return existing;

	const spec = server === 'fff'
		? { command: config.mcp.fff.command, args: [path.resolve(cwd)] }
		: config.mcp.context7;
	// ponytail: one fff process per opened repo; add LRU eviction if long-running multi-repo use matters.
	const connection = openMcp(spec, server === 'fff' ? 250 : 0);
	mcpConnectionPool.set(key, connection);
	void connection.catch(() => {
		if (mcpConnectionPool.get(key) === connection) mcpConnectionPool.delete(key);
	});
	return connection;
}

export async function callMcp(server: McpServer, cwd: string, name: string, args: ToolArguments): Promise<string> {
	const key = server === 'fff' ? `fff:${path.resolve(cwd)}` : server;
	const connection = getMcpConnection(server, cwd);
	try {
		const result = await (await connection).callTool({ name, arguments: args });
		const content = z.array(McpToolContent).parse(result.content ?? []);
		return content.filter(item => item.type === 'text').map(item => item.text ?? '').join('\n');
	} catch (error) {
		if (mcpConnectionPool.get(key) === connection) mcpConnectionPool.delete(key);
		const client = await connection.catch(() => undefined);
		await client?.close().catch(() => undefined);
		throw error;
	}
}

export async function warmMcpConnections(cwd: string): Promise<void> {
	await Promise.all([
		getMcpConnection('fff', cwd),
		getMcpConnection('context7', cwd),
	]);
}

export async function closeMcpConnections(): Promise<void> {
	const connections = [...mcpConnectionPool.values()];
	mcpConnectionPool.clear();
	const settled = await Promise.allSettled(connections);
	await Promise.all(settled.flatMap(result => result.status === 'fulfilled' ? [result.value.close().catch(() => undefined)] : []));
}

export function buildTools(definitions: RegisteredTool[], cwd: string): Record<string, BuiltTool> {
	const context = ToolContext.parse({ cwd });
	return Object.fromEntries(definitions.map(({ name, description, inputSchema, run }) => [name, tool({
		description,
		inputSchema,
		execute: args => run(args, context),
	})]));
}
