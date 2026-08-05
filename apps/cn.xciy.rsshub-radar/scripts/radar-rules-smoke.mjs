import fs from "node:fs";
import path from "node:path";

const appRoot = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, "manifest.json"), "utf8"));
const index = JSON.parse(fs.readFileSync(path.join(appRoot, "assets/rules/index.json"), "utf8"));

if (index.domainCount < 1000 || index.ruleCount < 4000) {
  throw new Error(`Rule catalog is unexpectedly small: ${index.domainCount}/${index.ruleCount}`);
}

for (const bucket of index.buckets) {
  const relative = `assets/rules/${bucket}.json`;
  if (!manifest.assets.includes(relative)) throw new Error(`Manifest is missing ${relative}`);
  const payload = JSON.parse(fs.readFileSync(path.join(appRoot, relative), "utf8"));
  if (!payload.domains || typeof payload.domains !== "object") {
    throw new Error(`Invalid rule bucket: ${relative}`);
  }
}

for (const domain of ["bilibili.com", "github.com", "youtube.com"]) {
  const bucket = domain[0];
  const payload = JSON.parse(
    fs.readFileSync(path.join(appRoot, `assets/rules/${bucket}.json`), "utf8"),
  );
  if (!payload.domains[domain]) throw new Error(`Expected domain is missing: ${domain}`);
}

console.log(
  `Validated ${index.domainCount} domains and ${index.ruleCount} RSSHub Radar rules in ${index.buckets.length} buckets.`,
);
