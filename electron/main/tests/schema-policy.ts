import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// @compile-time-only: diagnostic emitted only inside this static test.
export type SchemaPolicyViolation = {
	file: string;
	line: number;
	name: string;
};

function containsObjectShape(type: ts.TypeNode): boolean {
	if (ts.isTypeLiteralNode(type)) return true;
	if (ts.isParenthesizedTypeNode(type)) return containsObjectShape(type.type);
	if (ts.isUnionTypeNode(type) || ts.isIntersectionTypeNode(type)) {
		return type.types.some(containsObjectShape);
	}
	return false;
}

function isZodDerived(type: ts.TypeNode): boolean {
	if (!ts.isTypeReferenceNode(type) || !ts.isQualifiedName(type.typeName)) return false;
	return ts.isIdentifier(type.typeName.left)
		&& type.typeName.left.text === 'z'
		&& ['infer', 'input', 'output'].includes(type.typeName.right.text);
}

function hasCompileTimeOnlyReason(node: ts.Node, source: ts.SourceFile): boolean {
	const comments = ts.getLeadingCommentRanges(source.text, node.getFullStart()) ?? [];
	return comments.some(({ pos, end }) => /@compile-time-only:\s+\S/.test(source.text.slice(pos, end)));
}

export function findSchemaPolicyViolations(sourceText: string, file = 'source.ts'): SchemaPolicyViolation[] {
	const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
	const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
	const violations: SchemaPolicyViolation[] = [];

	function visit(node: ts.Node): void {
		const isHandRolledInterface = ts.isInterfaceDeclaration(node);
		const isHandRolledAlias = ts.isTypeAliasDeclaration(node)
			&& containsObjectShape(node.type)
			&& !isZodDerived(node.type);
		if ((isHandRolledInterface || isHandRolledAlias) && !hasCompileTimeOnlyReason(node, source)) {
			const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
			violations.push({ file, line: line + 1, name: node.name.text });
		}

		ts.forEachChild(node, visit);
	}
	visit(source);

	return violations;
}

function productionTypeScriptFiles(directory: string): string[] {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) return productionTypeScriptFiles(absolute);
		const isTypeScript = entry.name.endsWith('.ts') || entry.name.endsWith('.tsx');
		const isTest = entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx');
		return entry.isFile() && isTypeScript && !isTest
			? [absolute]
			: [];
	});
}

export function scanMainProcess(root = process.cwd()): SchemaPolicyViolation[] {
	const mainDirectory = path.join(root, 'electron/main');
	return productionTypeScriptFiles(mainDirectory).flatMap(file =>
		findSchemaPolicyViolations(fs.readFileSync(file, 'utf8'), path.relative(root, file)),
	);
}
