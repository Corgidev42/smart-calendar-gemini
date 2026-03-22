const raycastConfig = require("@raycast/eslint-config");

function flattenOneLevel(items) {
  const out = [];
  for (const item of items) {
    if (Array.isArray(item)) out.push(...item);
    else out.push(item);
  }
  return out;
}

module.exports = [
  ...flattenOneLevel(raycastConfig),
  {
    ignores: ["node_modules/**", "dist/**", "scripts/**"],
  },
];
