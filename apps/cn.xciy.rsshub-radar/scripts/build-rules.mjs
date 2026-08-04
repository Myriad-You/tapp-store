import fs from "node:fs";
import path from "node:path";
import ts from "../../../tapp-cli/node_modules/typescript/lib/typescript.js";

const sourcePath = process.argv[2];
const outputDir = process.argv[3];

if (!sourcePath || !outputDir) {
  console.error("Usage: node build-rules.mjs <radar-rules.ts> <output-dir>");
  process.exit(1);
}

const sourceText = fs.readFileSync(sourcePath, "utf8");
const sourceFile = ts.createSourceFile(
  sourcePath,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

let rulesInitializer;
for (const statement of sourceFile.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (declaration.name.getText(sourceFile) === "defaultRules") {
      rulesInitializer = declaration.initializer;
      break;
    }
  }
}

if (!rulesInitializer) {
  throw new Error("defaultRules object was not found");
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  throw new Error(`Unsupported property name: ${node.getText(sourceFile)}`);
}

function readLiteral(node) {
  if (ts.isParenthesizedExpression(node)) return readLiteral(node.expression);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
    return node.operator === ts.SyntaxKind.MinusToken
      ? -Number(node.operand.text)
      : Number(node.operand.text);
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map(readLiteral);
  }
  if (ts.isObjectLiteralExpression(node)) {
    const result = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) {
        throw new Error(`Unsupported object member: ${property.getText(sourceFile).slice(0, 120)}`);
      }
      result[propertyName(property.name)] = readLiteral(property.initializer);
    }
    return result;
  }
  throw new Error(`Unsupported value: ${node.getText(sourceFile).slice(0, 120)}`);
}

const rules = readLiteral(rulesInitializer);
const buckets = {};
let ruleCount = 0;

for (const [domain, domainRules] of Object.entries(rules)) {
  const first = domain.charAt(0).toLowerCase();
  const bucket = /^[a-z0-9]$/.test(first) ? first : "other";
  buckets[bucket] ||= {};
  buckets[bucket][domain] = domainRules;

  for (const [key, value] of Object.entries(domainRules)) {
    if (key !== "_name" && Array.isArray(value)) ruleCount += value.length;
  }
}

fs.mkdirSync(outputDir, { recursive: true });
const bucketNames = Object.keys(buckets).sort();
for (const bucket of bucketNames) {
  const target = path.join(outputDir, `${bucket}.json`);
  fs.writeFileSync(target, JSON.stringify({ domains: buckets[bucket] }));
}

fs.writeFileSync(
  path.join(outputDir, "index.json"),
  JSON.stringify({
    schemaVersion: 1,
    source: "https://github.com/DIYgod/RSSHub-Radar/tree/dev",
    license: "AGPL-3.0",
    domainCount: Object.keys(rules).length,
    ruleCount,
    buckets: bucketNames,
  }),
);

console.log(
  JSON.stringify({
    domainCount: Object.keys(rules).length,
    ruleCount,
    bucketCount: bucketNames.length,
  }),
);
