const MAX_LENGTH = 2000;

export function splitMessage(text: string): string[] {
  if (!text) return [];
  if (text.length <= MAX_LENGTH) return [text];

  const chunks: string[] = [];
  const lines = text.split("\n");
  let current = "";

  for (const line of lines) {
    if (line.length > MAX_LENGTH) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < line.length; i += MAX_LENGTH) {
        chunks.push(line.slice(i, i + MAX_LENGTH));
      }
      continue;
    }

    const separator = current ? "\n" : "";
    if ((current + separator + line).length > MAX_LENGTH) {
      chunks.push(current);
      current = line;
    } else {
      current = current + separator + line;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}
