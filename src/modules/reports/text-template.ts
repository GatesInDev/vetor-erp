const textBindingPattern = /(?<!\{)\{\{([^{}\r\n]*)\}\}(?!\})/g;

export function textBindings(text: string): string[] {
  return [...new Set([...text.matchAll(textBindingPattern)].map((match) => match[1].trim()))];
}

export function replaceTextBindings(text: string, resolve: (binding: string) => string): string {
  return text.replace(textBindingPattern, (_token, binding: string) => resolve(binding.trim()));
}

export function insertTextBinding(text: string, binding: string, selectionStart: number, selectionEnd: number): { text: string; caret: number } | null {
  const start = Math.max(0, Math.min(text.length, selectionStart));
  const end = Math.max(start, Math.min(text.length, selectionEnd));
  const token = `{{${binding}}}`;
  const result = `${text.slice(0, start)}${token}${text.slice(end)}`;
  return result.length <= 2000 ? { text: result, caret: start + token.length } : null;
}

export function removeTextBinding(text: string, binding: string): string {
  return text.replace(textBindingPattern, (token, candidate: string) => candidate.trim() === binding ? "" : token);
}
