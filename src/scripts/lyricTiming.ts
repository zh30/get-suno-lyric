export interface LineTiming {
  text: string;
  start_s: number;
  end_s: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function roundToMillis(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function sanitizeLyricText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .trim();
}

function normalizeLyricForMatch(text: string): string {
  return sanitizeLyricText(text)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[.,!?;:\uFF0C\u3002\uFF01\uFF1F\uFF1B\uFF1A\u3001'"\u201C\u201D\u2018\u2019`~\u00B7\-\u2014()\[\]{}]/g, '');
}

function isStructureLyricLine(text: string): boolean {
  const cleaned = sanitizeLyricText(text);
  return /^\[.*\]$/.test(cleaned) || /^\(.*\)$/.test(cleaned) || /^\uFF08.*\uFF09$/.test(cleaned);
}

const SUNO_TAG_KEYWORDS = new Set([
  'adlib',
  'adlibs',
  'announcer',
  'band',
  'bass',
  'break',
  'bridge',
  'build',
  'buildup',
  'choir',
  'chorus',
  'climax',
  'crescendo',
  'delay',
  'drop',
  'drum',
  'drums',
  'duet',
  'echo',
  'end',
  'ending',
  'escalate',
  'fade',
  'fading',
  'female',
  'finish',
  'guitar',
  'harmonies',
  'harmony',
  'hook',
  'hum',
  'humming',
  'instrumental',
  'instrumentale',
  'instruments',
  'interlude',
  'intro',
  'jam',
  'lyrics',
  'male',
  'melodic',
  'narrator',
  'outro',
  'piano',
  'postchorus',
  'prechorus',
  'rap',
  'refrain',
  'reprise',
  'reverb',
  'sax',
  'saxophone',
  'shouted',
  'singing',
  'solo',
  'softly',
  'spoken',
  'strings',
  'sung',
  'synth',
  'tension',
  'verse',
  'vocal',
  'vocals',
  'whisper',
  'whispered',
  'word'
]);

function getTagWords(text: string): string[] {
  return sanitizeLyricText(text)
    .toLowerCase()
    .replace(/pre[\s-]+chorus/g, 'prechorus')
    .replace(/post[\s-]+chorus/g, 'postchorus')
    .match(/[a-z0-9]+/g) ?? [];
}

function isRecognizedSunoTagContent(content: string): boolean {
  const words = getTagWords(content);
  if (words.length === 0) {
    return false;
  }

  return words.some((word) => SUNO_TAG_KEYWORDS.has(word));
}

function readLeadingWrappedTag(text: string):
  | { content: string; rest: string; requiresKnownTag: boolean }
  | undefined {
  const cleaned = sanitizeLyricText(text);
  const first = cleaned[0];
  const pairs: Record<string, { close: string; requiresKnownTag: boolean }> = {
    '[': { close: ']', requiresKnownTag: false },
    '(': { close: ')', requiresKnownTag: true },
    '\uFF08': { close: '\uFF09', requiresKnownTag: true }
  };
  const pair = pairs[first];
  if (!pair) {
    return undefined;
  }

  const closeIndex = cleaned.indexOf(pair.close, 1);
  if (closeIndex < 0) {
    return undefined;
  }

  return {
    content: cleaned.slice(1, closeIndex),
    rest: cleaned.slice(closeIndex + pair.close.length),
    requiresKnownTag: pair.requiresKnownTag
  };
}

export function stripSunoTagsForLyricDownload(text: string): string {
  let remaining = sanitizeLyricText(text);

  while (remaining.length > 0) {
    const tag = readLeadingWrappedTag(remaining);
    if (!tag) {
      break;
    }

    const content = sanitizeLyricText(tag.content);
    if (!content || (tag.requiresKnownTag && !isRecognizedSunoTagContent(content))) {
      break;
    }

    remaining = sanitizeLyricText(tag.rest);
  }

  return remaining;
}

export function prepareLyricDownloadLines(lines: LineTiming[]): LineTiming[] {
  return lines
    .map((line) => ({
      text: stripSunoTagsForLyricDownload(line.text),
      start_s: line.start_s,
      end_s: line.end_s
    }))
    .filter((line) => line.text.length > 0);
}

function isPunctuationOnlyFragment(text: string): boolean {
  const cleaned = sanitizeLyricText(text);
  return cleaned.length > 0 &&
    /^[\s.,!?;:\uFF0C\u3002\uFF01\uFF1F\uFF1B\uFF1A\u3001'"\u201C\u201D\u2018\u2019`\u00B7\-\u2013\u2014()\[\]{}]+$/.test(cleaned);
}

function hasTrailingPunctuation(text: string): boolean {
  return /[.,!?;:\uFF0C\u3002\uFF01\uFF1F\uFF1B\uFF1A\u3001'"\u201C\u201D\u2018\u2019`\)\]\}]$/.test(sanitizeLyricText(text));
}

function getLetters(text: string): string[] {
  return sanitizeLyricText(text).match(/\p{L}/gu) ?? [];
}

function endsWithLetter(text: string): boolean {
  const cleaned = sanitizeLyricText(text);
  return /\p{L}$/u.test(cleaned);
}

function startsWithLowercaseLetter(text: string): boolean {
  const letters = getLetters(text);
  if (letters.length === 0) {
    return false;
  }

  const firstLetter = letters[0];
  return firstLetter === firstLetter.toLocaleLowerCase() &&
    firstLetter !== firstLetter.toLocaleUpperCase();
}

function lyricUnits(text: string): number {
  return normalizeLyricForMatch(text).length;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function estimateSecondsPerLyricUnit(alignedLines: LineTiming[]): number {
  const samples = alignedLines
    .filter((line) => !isStructureLyricLine(line.text))
    .map((line) => {
      const units = lyricUnits(line.text);
      const duration = line.end_s - line.start_s;
      if (units <= 0 || duration <= 0.1) {
        return undefined;
      }
      return duration / units;
    })
    .filter((value): value is number => isFiniteNumber(value) && value > 0);

  if (samples.length === 0) {
    return 0.22;
  }

  const estimate = median(samples);
  return Math.min(0.45, Math.max(0.08, estimate));
}

function estimateMissingLineDuration(line: string, secondsPerUnit: number): number {
  if (isStructureLyricLine(line)) {
    return 0.35;
  }

  const units = Math.max(1, lyricUnits(line));
  const estimated = units * secondsPerUnit;
  return Math.min(5, Math.max(0.7, estimated));
}

function parsePromptLines(prompt: string): string[] {
  return prompt
    .split(/\r?\n/)
    .map((line) => sanitizeLyricText(line))
    .filter((line) => line.length > 0);
}

function isAdjacentContinuation(previous: LineTiming, current: LineTiming): boolean {
  if (!isFiniteNumber(previous.end_s) || !isFiniteNumber(current.start_s)) {
    return false;
  }

  const gap = current.start_s - previous.end_s;
  return current.start_s + 0.05 >= previous.start_s && gap <= 0.35;
}

function shouldMergeShortFragment(previous: LineTiming, current: LineTiming): boolean {
  if (isStructureLyricLine(previous.text) || isStructureLyricLine(current.text)) {
    return false;
  }
  if (!isAdjacentContinuation(previous, current)) {
    return false;
  }
  if (isPunctuationOnlyFragment(current.text)) {
    return true;
  }

  const units = lyricUnits(current.text);
  if (units <= 0 || units > 3) {
    return false;
  }

  const duration = current.end_s - current.start_s;
  return duration <= 0.85 &&
    endsWithLetter(previous.text) &&
    startsWithLowercaseLetter(current.text) &&
    (units === 1 || hasTrailingPunctuation(current.text));
}

function mergeLinePair(previous: LineTiming, current: LineTiming): LineTiming {
  return {
    text: `${sanitizeLyricText(previous.text)}${sanitizeLyricText(current.text)}`,
    start_s: previous.start_s,
    end_s: roundToMillis(Math.max(previous.end_s, current.end_s, previous.start_s + 0.02))
  };
}

function findPromptCandidate(
  normalizedLine: string,
  normalizedPromptLines: string[],
  promptCursor: number
): { index: number; exact: boolean } | undefined {
  if (!normalizedLine) {
    return undefined;
  }

  for (let index = promptCursor; index < normalizedPromptLines.length; index += 1) {
    const candidate = normalizedPromptLines[index];
    if (!candidate) {
      continue;
    }
    if (candidate === normalizedLine) {
      return { index, exact: true };
    }
    if (normalizedLine.length >= 5 && candidate.startsWith(normalizedLine)) {
      return { index, exact: false };
    }
  }

  return undefined;
}

function collectPromptContinuation(
  lines: LineTiming[],
  startIndex: number,
  targetNormalized: string
): { endIndex: number; end_s: number } | undefined {
  let combinedNormalized = normalizeLyricForMatch(lines[startIndex].text);
  let previousLine = lines[startIndex];
  let end = previousLine.end_s;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const currentLine = lines[index];
    if (isStructureLyricLine(currentLine.text) || !isAdjacentContinuation(previousLine, currentLine)) {
      break;
    }

    const currentNormalized = normalizeLyricForMatch(currentLine.text);
    if (!currentNormalized) {
      break;
    }

    const nextNormalized = combinedNormalized + currentNormalized;
    if (!targetNormalized.startsWith(nextNormalized)) {
      break;
    }

    combinedNormalized = nextNormalized;
    end = Math.max(end, currentLine.end_s);
    previousLine = currentLine;

    if (combinedNormalized === targetNormalized) {
      return { endIndex: index, end_s: roundToMillis(end) };
    }
  }

  return undefined;
}

export function mergeLyricLineFragments(lines: LineTiming[], prompt?: string): LineTiming[] {
  if (lines.length === 0) {
    return [];
  }

  const promptLines = prompt ? parsePromptLines(prompt) : [];
  const normalizedPromptLines = promptLines.map((line) => normalizeLyricForMatch(line));
  const merged: LineTiming[] = [];
  let promptCursor = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = {
      text: sanitizeLyricText(lines[index].text),
      start_s: lines[index].start_s,
      end_s: lines[index].end_s
    };

    if (!line.text) {
      continue;
    }

    const normalizedLine = normalizeLyricForMatch(line.text);
    const promptCandidate = findPromptCandidate(normalizedLine, normalizedPromptLines, promptCursor);
    if (promptCandidate && !promptCandidate.exact) {
      const continuation = collectPromptContinuation(lines, index, normalizedPromptLines[promptCandidate.index]);
      if (continuation) {
        merged.push({
          text: promptLines[promptCandidate.index],
          start_s: line.start_s,
          end_s: continuation.end_s
        });
        promptCursor = promptCandidate.index + 1;
        index = continuation.endIndex;
        continue;
      }
    }

    const previous = merged[merged.length - 1];
    if (previous && shouldMergeShortFragment(previous, line)) {
      merged[merged.length - 1] = mergeLinePair(previous, line);
      continue;
    }

    merged.push(line);
    if (promptCandidate?.exact) {
      promptCursor = promptCandidate.index + 1;
    }
  }

  return merged;
}

function buildLineTimingsFromStarts(
  lines: Array<{ text: string; start_s: number }>,
  durationS?: number
): LineTiming[] {
  if (lines.length === 0) {
    return [];
  }

  const normalizedStarts = lines.map((line) => ({
    text: sanitizeLyricText(line.text),
    start_s: isFiniteNumber(line.start_s) ? line.start_s : 0
  }));

  const startDiffs = normalizedStarts
    .slice(1)
    .map((line, index) => line.start_s - normalizedStarts[index].start_s)
    .filter((diff) => diff > 0.05);
  const fallbackDuration = startDiffs.length > 0 ? median(startDiffs) : 2.5;

  const sanitizedStarts: Array<{ text: string; start_s: number }> = [];
  let lastStart = 0;
  normalizedStarts.forEach((line, index) => {
    if (!line.text) {
      return;
    }

    let start = Math.max(0, line.start_s);
    if (index > 0 && start < lastStart) {
      start = lastStart;
    }
    if (isFiniteNumber(durationS) && start > durationS) {
      start = durationS;
    }

    sanitizedStarts.push({
      text: line.text,
      start_s: roundToMillis(start)
    });
    lastStart = start;
  });

  if (sanitizedStarts.length === 0) {
    return [];
  }

  return sanitizedStarts.map((line, index) => {
    let end = index < sanitizedStarts.length - 1
      ? sanitizedStarts[index + 1].start_s
      : line.start_s + fallbackDuration;

    if (isFiniteNumber(durationS) && end > durationS) {
      end = durationS;
    }
    if (end < line.start_s + 0.02) {
      end = line.start_s + 0.02;
    }

    return {
      text: line.text,
      start_s: line.start_s,
      end_s: roundToMillis(end)
    };
  });
}

export function repairMissingPromptLines(
  alignedLines: LineTiming[],
  prompt?: string,
  durationS?: number
): { lines: LineTiming[]; insertedCount: number } {
  if (!prompt || alignedLines.length < 2) {
    return { lines: alignedLines, insertedCount: 0 };
  }

  const promptLines = parsePromptLines(prompt);
  if (promptLines.length === 0) {
    return { lines: alignedLines, insertedCount: 0 };
  }
  const secondsPerUnit = estimateSecondsPerLyricUnit(alignedLines);

  const alignedStarts = alignedLines.map((line) => ({
    text: sanitizeLyricText(line.text),
    start_s: line.start_s
  }));
  const promptNormalized = promptLines.map((line) => normalizeLyricForMatch(line));

  let promptCursor = 0;
  const matchedPromptIndexes = alignedStarts.map((line) => {
    const normalizedLine = normalizeLyricForMatch(line.text);
    if (!normalizedLine) {
      return -1;
    }

    for (let index = promptCursor; index < promptNormalized.length; index += 1) {
      const candidate = promptNormalized[index];
      if (!candidate) {
        continue;
      }

      if (
        candidate === normalizedLine ||
        candidate.includes(normalizedLine) ||
        normalizedLine.includes(candidate)
      ) {
        promptCursor = index + 1;
        return index;
      }
    }

    return -1;
  });

  const firstMatchedLineIndex = matchedPromptIndexes.findIndex((index) => index >= 0);
  if (firstMatchedLineIndex < 0) {
    return { lines: alignedLines, insertedCount: 0 };
  }

  const pushMissingLines = (
    target: Array<{ text: string; start_s: number }>,
    missingLines: string[],
    windowStart: number,
    windowEnd: number
  ) => {
    if (missingLines.length === 0) {
      return 0;
    }

    const minimumDuration = 0.18;
    const available = Math.max(0, windowEnd - windowStart);
    if (available <= minimumDuration) {
      return 0;
    }

    const expectedDurations = missingLines.map((line) =>
      Math.max(minimumDuration, estimateMissingLineDuration(line, secondsPerUnit))
    );

    let totalDuration = expectedDurations.reduce((acc, duration) => acc + duration, 0);
    const minimumTotalDuration = missingLines.length * minimumDuration;
    const compressionRatio = available / Math.max(totalDuration, 1e-6);

    if (available < minimumTotalDuration || compressionRatio < 0.55) {
      return 0;
    }

    if (totalDuration > available) {
      const scale = available / totalDuration;
      for (let index = 0; index < expectedDurations.length; index += 1) {
        expectedDurations[index] = Math.max(minimumDuration, expectedDurations[index] * scale);
      }
      totalDuration = expectedDurations.reduce((acc, duration) => acc + duration, 0);
    }

    if (totalDuration > available) {
      const overflow = totalDuration - available;
      let adjustable = expectedDurations.reduce(
        (acc, duration) => acc + Math.max(0, duration - minimumDuration),
        0
      );
      if (adjustable > 0 && overflow > 0) {
        for (let index = 0; index < expectedDurations.length; index += 1) {
          const room = Math.max(0, expectedDurations[index] - minimumDuration);
          const deduction = Math.min(room, (room / adjustable) * overflow);
          expectedDurations[index] -= deduction;
        }
      }
      totalDuration = expectedDurations.reduce((acc, duration) => acc + duration, 0);
    }

    let cursor = Math.max(windowStart, windowEnd - totalDuration);
    missingLines.forEach((missingLine, missingIndex) => {
      target.push({
        text: missingLine,
        start_s: cursor
      });
      cursor += expectedDurations[missingIndex];
    });

    return missingLines.length;
  };

  const rebuiltStarts: Array<{ text: string; start_s: number }> = [];
  let previousMatchedPrompt = -1;
  let insertedCount = 0;

  for (let index = 0; index < alignedStarts.length; index += 1) {
    const line = alignedStarts[index];
    const currentMatchedPrompt = matchedPromptIndexes[index];

    if (index === firstMatchedLineIndex && currentMatchedPrompt > 0) {
      const leadingCandidates = promptLines.slice(0, currentMatchedPrompt);
      const currentNorm = normalizeLyricForMatch(line.text);
      const missingLeading = leadingCandidates.filter((candidate) => normalizeLyricForMatch(candidate) !== currentNorm);

      if (missingLeading.length > 0) {
        const windowEnd = line.start_s;
        const estimatedLeadWindow = Math.max(1.2, missingLeading.length * 0.9);
        const windowStart = Math.max(0, windowEnd - estimatedLeadWindow);
        insertedCount += pushMissingLines(rebuiltStarts, missingLeading, windowStart, windowEnd);
      }
    }

    if (
      currentMatchedPrompt >= 0 &&
      previousMatchedPrompt >= 0 &&
      currentMatchedPrompt - previousMatchedPrompt > 1
    ) {
      const missingCandidates = promptLines.slice(previousMatchedPrompt + 1, currentMatchedPrompt);
      const currentNorm = normalizeLyricForMatch(line.text);
      const previousNorm = rebuiltStarts.length > 0
        ? normalizeLyricForMatch(rebuiltStarts[rebuiltStarts.length - 1].text)
        : '';
      const missingLines = missingCandidates.filter((missingLine) => {
        const normalizedMissing = normalizeLyricForMatch(missingLine);
        return normalizedMissing.length > 0 && normalizedMissing !== previousNorm && normalizedMissing !== currentNorm;
      });

      if (missingLines.length > 0) {
        const windowEnd = line.start_s;
        const windowStart = rebuiltStarts.length > 0
          ? rebuiltStarts[rebuiltStarts.length - 1].start_s
          : Math.max(0, windowEnd - Math.max(1, missingLines.length * 0.9));
        insertedCount += pushMissingLines(rebuiltStarts, missingLines, windowStart, windowEnd);
      }
    }

    rebuiltStarts.push(line);
    if (currentMatchedPrompt >= 0) {
      previousMatchedPrompt = currentMatchedPrompt;
    }
  }

  if (insertedCount === 0) {
    return { lines: alignedLines, insertedCount: 0 };
  }

  return {
    lines: buildLineTimingsFromStarts(rebuiltStarts, durationS),
    insertedCount
  };
}
