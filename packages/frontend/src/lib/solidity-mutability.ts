/**
 * Best-effort detection of read-only entry points in Solidity source.
 *
 * Used purely as a UI hint (to style "call" vs "transact" buttons). It never
 * changes how a function is invoked, so a wrong guess is cosmetic only.
 */

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const NON_DECLARATION_KEYWORDS = /^(function|event|error|return|emit|import|pragma|using|modifier|constructor|require|revert|if|for|while|delete)\b/;

export function getReadOnlyFunctions(source: string): string[] {
  if (!source) return [];
  const code = stripComments(source);
  const readOnly = new Set<string>();

  // `function name(...) <modifiers> {` — read-only when `view` or `pure`.
  const fnRe = /\bfunction\s+([A-Za-z_]\w*)\s*\(([^)]*)\)([^{;]*)[{;]/g;
  for (const match of Array.from(code.matchAll(fnRe))) {
    const [, name, , modifiers] = match;
    if (/\b(view|pure)\b/.test(modifiers)) {
      readOnly.add(name);
    }
  }

  // `<type> public <name> [= ...];` — compiler-generated getters are read-only.
  for (const rawStatement of code.split(/[;{}]/)) {
    const statement = rawStatement.trim().replace(/\s+/g, " ");
    if (!statement || NON_DECLARATION_KEYWORDS.test(statement)) continue;
    if (!/\bpublic\b/.test(statement)) continue;
    if (statement.includes("(") && !statement.startsWith("mapping")) continue;
    const declaration = statement.split(/=(?!>)/)[0].trim();
    const name = declaration.match(/([A-Za-z_]\w*)$/)?.[1];
    if (name && name !== "public") {
      readOnly.add(name);
    }
  }

  return Array.from(readOnly);
}
