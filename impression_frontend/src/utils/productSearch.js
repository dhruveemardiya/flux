const WHITESPACE_RE = /[\s\u00a0\u2000-\u200b\u202f\u205f\u3000]+/g;
const DASH_RE = /[\u2010-\u2015\u2212−‑‒–—―]/g;

export const normalizeProductDisplayName = (text) =>
  String(text ?? "").trim().replace(/\s+/g, " ");

export const normalizeProductSearchText = (text) =>
  String(text ?? "")
    .toLowerCase()
    .replace(DASH_RE, "-")
    .replace(WHITESPACE_RE, " ")
    .trim();

const compactProductSearchText = (text) =>
  normalizeProductSearchText(text).replace(/[\s-]/g, "");

export const productNameMatchesSearch = (productName, searchTerm) => {
  const term = normalizeProductSearchText(searchTerm);
  if (!term) return true;

  const name = normalizeProductSearchText(productName);
  const compactName = compactProductSearchText(productName);
  const compactTerm = compactProductSearchText(searchTerm);

  if (name.includes(term)) return true;
  if (compactTerm && compactName.includes(compactTerm)) return true;

  const tokens = term.split(/[\s-]+/).filter(Boolean);
  if (tokens.length === 0) return true;

  return tokens.every(
    (token) => name.includes(token) || compactName.includes(token)
  );
};
