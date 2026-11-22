// Cuts streamed text into sentences. A sentence is complete when its end
// punctuation is followed by white space. A dot inside a number (1,30 or 2.50)
// is never followed by white space, so it never splits. flush() emits the rest.
const END_THEN_SPACE = /[.?!…]+\s/;

export function createSentenceChunker(onSentence: (s: string) => void): {
  push(textDelta: string): void;
  flush(): void;
} {
  let buffer = "";

  function emit(raw: string): void {
    const sentence = raw.trim();
    if (sentence.length > 0 && /[\p{L}\p{N}]/u.test(sentence)) onSentence(sentence);
  }

  return {
    push(textDelta) {
      buffer += textDelta;
      for (;;) {
        const match = END_THEN_SPACE.exec(buffer);
        if (!match) break;
        const end = match.index + match[0].length;
        const piece = buffer.slice(0, end);
        buffer = buffer.slice(end);
        emit(piece);
      }
    },
    flush() {
      const rest = buffer;
      buffer = "";
      emit(rest);
    },
  };
}
