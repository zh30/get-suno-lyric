interface AlignedToken {
  text?: string;
  word?: string;
  start_s?: number;
  end_s?: number;
}

interface AlignedLine {
  text?: string;
  word?: string;
  start_s?: number;
  end_s?: number;
  section?: string;
  words?: AlignedToken[];
}

interface LineTiming {
  text: string;
  start_s: number;
  end_s: number;
}

interface ApiResponse {
  aligned_lyrics?: AlignedLine[];
  aligned_words?: AlignedToken[];
  waveform_data?: number[];
  duration_s?: number;
  duration?: number;
  // Add other possible fields that might contain duration
  [key: string]: any;
}

interface ClipMetadata {
  id: string;
  duration?: number; // Duration in seconds
  metadata: {
    prompt: string;
    gpt_description_prompt?: string;
    duration_formatted?: string;
    duration?: number; // Duration in seconds - THIS is where it actually is!
  };
}

interface LyricsData {
  type: 'aligned' | 'plain';
  data: LineTiming[] | string;
}

type FileType = 'lrc' | 'srt';

const API_BASE_URL = 'https://studio-api.prod.suno.com/api';
const GEN_API_URL = 'https://studio-api.prod.suno.com/api/gen';

// Cache for API responses
const lyricsCache = new Map<string, LyricsData>();

// Styles
const STYLES = `
  .suno-lyric-downloader-btn {
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
    font-weight: 600;
    text-align: center;
    border-radius: 0.5rem;
    cursor: pointer;
    background-color: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: white;
    padding: 0.6rem 1rem;
    min-width: 0;
    font-size: 0.875rem;
    line-height: 1.25rem;
    display: block;
    width: 100%;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
  }
  .suno-lyric-downloader-btn:hover {
    background-color: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  .suno-lyric-downloader-btn:active {
    transform: translateY(0);
    background-color: rgba(255, 255, 255, 0.2);
  }
  .suno-lyric-downloader-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 100%);
    backdrop-filter: blur(4px);
    z-index: 10;
    box-sizing: border-box;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
`;

interface RawLineTiming {
  text: string;
  start_s?: number;
  end_s?: number;
}

interface TimingScore {
  validCount: number;
  monotonicBreaks: number;
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
    .replace(/[.,!?;:，。！？；：、'"“”‘’`~·\-—()\[\]{}]/g, '');
}

function isStructureLyricLine(text: string): boolean {
  const cleaned = sanitizeLyricText(text);
  return /^\[.*\]$/.test(cleaned) || /^\(.*\)$/.test(cleaned) || /^（.*）$/.test(cleaned);
}

function lyricUnits(text: string): number {
  return normalizeLyricForMatch(text).length;
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

function getLineText(line: AlignedLine): string {
  const textCandidate =
    (typeof line.text === 'string' && line.text) ||
    (typeof line.word === 'string' && line.word) ||
    (Array.isArray(line.words) && line.words.length > 0
      ? line.words
          .map((token) => (typeof token.text === 'string' ? token.text : token.word ?? ''))
          .join('')
      : '');

  const normalized = sanitizeLyricText(textCandidate);
  return normalized.length > 0 ? normalized : '';
}

function deriveTimingsFromWords(lines: AlignedLine[]): RawLineTiming[] {
  return lines.map((line) => {
    const wordStarts = (line.words ?? [])
      .map((word) => word.start_s)
      .filter(isFiniteNumber);
    const wordEnds = (line.words ?? [])
      .map((word) => word.end_s)
      .filter(isFiniteNumber);

    if (wordStarts.length > 0 && wordEnds.length > 0) {
      return {
        text: getLineText(line),
        start_s: Math.min(...wordStarts),
        end_s: Math.max(...wordEnds)
      };
    }

    // Some payloads miss per-word timing for specific lines while line-level timing still exists.
    if (isFiniteNumber(line.start_s) || isFiniteNumber(line.end_s)) {
      return {
        text: getLineText(line),
        start_s: isFiniteNumber(line.start_s) ? line.start_s : undefined,
        end_s: isFiniteNumber(line.end_s) ? line.end_s : undefined
      };
    }

    return {
      text: getLineText(line),
      start_s: undefined,
      end_s: undefined
    };
  });
}

function deriveTimingsFromLines(lines: AlignedLine[]): RawLineTiming[] {
  return lines.map((line) => ({
    text: getLineText(line),
    start_s: isFiniteNumber(line.start_s) ? line.start_s : undefined,
    end_s: isFiniteNumber(line.end_s) ? line.end_s : undefined
  }));
}

function scoreTimings(lines: RawLineTiming[]): TimingScore {
  let validCount = 0;
  let monotonicBreaks = 0;
  let previousStart: number | undefined;

  lines.forEach((line) => {
    if (isFiniteNumber(line.start_s) && isFiniteNumber(line.end_s)) {
      validCount += 1;
    }

    if (!isFiniteNumber(line.start_s)) {
      return;
    }

    if (isFiniteNumber(previousStart) && line.start_s + 0.001 < previousStart) {
      monotonicBreaks += 1;
    }

    previousStart = line.start_s;
  });

  return { validCount, monotonicBreaks };
}

function looksLikeRelativeLineTimings(lines: RawLineTiming[], durationS?: number): boolean {
  const starts = lines.map((line) => line.start_s).filter(isFiniteNumber);
  const ends = lines.map((line) => line.end_s).filter(isFiniteNumber);

  if (starts.length === 0 || ends.length === 0) {
    return false;
  }

  const zeroStarts = starts.filter((start) => start <= 0.001).length;
  const mostlyZeroStarts = zeroStarts / starts.length >= 0.8;
  const uniqueStarts = new Set(starts.map((start) => Math.round(start * 1000) / 1000)).size;
  const maxEnd = Math.max(...ends);
  const { monotonicBreaks } = scoreTimings(lines);

  if (isFiniteNumber(durationS) && durationS > 10 && maxEnd < Math.min(5, durationS * 0.2)) {
    return true;
  }

  if (mostlyZeroStarts && (monotonicBreaks > 0 || uniqueStarts <= 2)) {
    return true;
  }

  return false;
}

function extractRelativeDurations(lines: RawLineTiming[]): number[] {
  const candidates = lines.map((line) => {
    if (isFiniteNumber(line.start_s) && isFiniteNumber(line.end_s)) {
      const duration = line.end_s - line.start_s;
      return duration > 0 ? duration : undefined;
    }
    if (isFiniteNumber(line.end_s)) {
      return line.end_s > 0 ? line.end_s : undefined;
    }
    return undefined;
  });

  const validDurations = candidates.filter((duration): duration is number => isFiniteNumber(duration) && duration > 0);
  const fallbackDuration = validDurations.length > 0 ? median(validDurations) : 0.5;

  return candidates.map((duration) => (isFiniteNumber(duration) && duration > 0 ? duration : fallbackDuration));
}

function expandRelativeTimings(lines: RawLineTiming[], durationS?: number): RawLineTiming[] {
  const durations = extractRelativeDurations(lines);
  const totalRelative = durations.reduce<number>((acc, duration) => acc + duration, 0);
  const scale = isFiniteNumber(durationS) && totalRelative > 0 ? durationS / totalRelative : 1;

  let cursor = 0;
  return lines.map((line, index) => {
    const duration = durations[index] * scale;
    const start = cursor;
    const end = start + duration;
    cursor = end;
    return {
      text: line.text,
      start_s: start,
      end_s: end
    };
  });
}

function percentile(values: number[], percent: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  if (percent <= 0) {
    return sorted[0];
  }
  if (percent >= 1) {
    return sorted[sorted.length - 1];
  }

  const position = (sorted.length - 1) * percent;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}

function smoothSeries(values: number[], radius: number): number[] {
  if (radius <= 0 || values.length === 0) {
    return [...values];
  }

  return values.map((_, index) => {
    let sum = 0;
    let count = 0;

    const left = Math.max(0, index - radius);
    const right = Math.min(values.length - 1, index + radius);
    for (let cursor = left; cursor <= right; cursor += 1) {
      sum += values[cursor];
      count += 1;
    }

    return count > 0 ? sum / count : 0;
  });
}

function lowerBound(sortedValues: number[], target: number): number {
  let left = 0;
  let right = sortedValues.length - 1;

  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    if (sortedValues[middle] < target) {
      left = middle + 1;
    } else {
      right = middle;
    }
  }

  return left;
}

function alignRelativeTimingsWithWaveform(
  lines: RawLineTiming[],
  durationS: number,
  waveformData?: number[]
): { lines: RawLineTiming[]; usedWaveform: boolean } {
  if (!Array.isArray(waveformData) || waveformData.length < 2 || !isFiniteNumber(durationS) || durationS <= 0) {
    return { lines: expandRelativeTimings(lines, durationS), usedWaveform: false };
  }

  const durations = extractRelativeDurations(lines);
  const totalRelative = durations.reduce((acc, duration) => acc + duration, 0);
  if (totalRelative <= 0) {
    return { lines: expandRelativeTimings(lines, durationS), usedWaveform: false };
  }

  const sanitized = waveformData.map((value) => (isFiniteNumber(value) && value > 0 ? value : 0));
  const smoothed = smoothSeries(sanitized, 2);
  const positive = smoothed.filter((value) => value > 0);
  if (positive.length < 2) {
    return { lines: expandRelativeTimings(lines, durationS), usedWaveform: false };
  }

  const low = percentile(positive, 0.2);
  const high = percentile(positive, 0.85);
  const activityThreshold = low + (high - low) * 0.22;
  const firstActiveIndex = smoothed.findIndex((value) => value >= activityThreshold);
  const lastActiveIndexFromEnd = [...smoothed].reverse().findIndex((value) => value >= activityThreshold);
  const lastActiveIndex = lastActiveIndexFromEnd >= 0 ? smoothed.length - 1 - lastActiveIndexFromEnd : -1;

  if (firstActiveIndex < 0 || lastActiveIndex <= firstActiveIndex) {
    return { lines: expandRelativeTimings(lines, durationS), usedWaveform: false };
  }

  const totalBuckets = Math.max(smoothed.length - 1, 1);
  const secondsPerBucket = durationS / totalBuckets;
  const leadInBuckets = Math.min(
    firstActiveIndex,
    Math.max(1, Math.round(0.2 / Math.max(secondsPerBucket, 1e-6)))
  );
  const leadOutBuckets = Math.max(1, Math.round(0.3 / Math.max(secondsPerBucket, 1e-6)));
  const windowStartIndex = Math.max(0, firstActiveIndex - leadInBuckets);
  const windowEndIndex = Math.min(smoothed.length - 1, lastActiveIndex + leadOutBuckets);

  if (windowEndIndex - windowStartIndex < 8) {
    return { lines: expandRelativeTimings(lines, durationS), usedWaveform: false };
  }

  const windowSeries = smoothed.slice(windowStartIndex, windowEndIndex + 1);
  const threshold = low + (high - low) * 0.15;
  const dynamicRange = Math.max(high - threshold, 1e-6);

  const weights = windowSeries.map((value) => {
    const lifted = Math.max(value - threshold, 0) / dynamicRange;
    const emphasized = Math.pow(lifted, 1.25);
    return 0.005 + emphasized;
  });

  const cumulative: number[] = [];
  let cumulativeWeight = 0;
  weights.forEach((weight) => {
    cumulativeWeight += weight;
    cumulative.push(cumulativeWeight);
  });

  if (cumulativeWeight <= 0) {
    return { lines: expandRelativeTimings(lines, durationS), usedWaveform: false };
  }

  const boundaries: number[] = [(windowStartIndex / totalBuckets) * durationS];
  const windowDenominator = Math.max(weights.length - 1, 1);
  let relativeCursor = 0;

  durations.forEach((duration) => {
    relativeCursor += duration;
    const target = (relativeCursor / totalRelative) * cumulativeWeight;
    const bucketIndex = lowerBound(cumulative, target);
    const previousValue = bucketIndex > 0 ? cumulative[bucketIndex - 1] : 0;
    const currentValue = cumulative[bucketIndex];
    const bucketFraction = currentValue > previousValue ? (target - previousValue) / (currentValue - previousValue) : 0;
    const waveformIndex = Math.min(bucketIndex + bucketFraction, windowDenominator);
    const absoluteIndex = windowStartIndex + waveformIndex;
    boundaries.push((absoluteIndex / totalBuckets) * durationS);
  });

  boundaries[boundaries.length - 1] = (windowEndIndex / totalBuckets) * durationS;

  const minStep = 0.02;
  for (let index = 1; index < boundaries.length; index += 1) {
    if (boundaries[index] < boundaries[index - 1] + minStep) {
      boundaries[index] = boundaries[index - 1] + minStep;
    }
  }

  const windowEndTime = (windowEndIndex / totalBuckets) * durationS;
  const timelineEnd = boundaries[boundaries.length - 1];
  if (timelineEnd > windowEndTime) {
    const startTime = boundaries[0];
    const currentRange = Math.max(timelineEnd - startTime, minStep);
    const targetRange = Math.max(windowEndTime - startTime, minStep);
    const scale = targetRange / currentRange;

    for (let index = 1; index < boundaries.length; index += 1) {
      boundaries[index] = startTime + (boundaries[index] - startTime) * scale;
      if (boundaries[index] < boundaries[index - 1] + minStep) {
        boundaries[index] = boundaries[index - 1] + minStep;
      }
    }
    boundaries[boundaries.length - 1] = windowEndTime;
  }

  return {
    lines: lines.map((line, index) => {
      const start = boundaries[index];
      const end = Math.max(boundaries[index + 1], start + minStep);
      return {
        text: line.text,
        start_s: start,
        end_s: end
      };
    }),
    usedWaveform: true
  };
}

function chooseTimingSource(
  wordTimings: RawLineTiming[],
  lineTimings: RawLineTiming[]
): { source: 'words' | 'lines'; timings: RawLineTiming[]; score: TimingScore } {
  const wordScore = scoreTimings(wordTimings);
  const lineScore = scoreTimings(lineTimings);
  const total = Math.max(wordTimings.length, 1);
  const wordRatio = wordScore.validCount / total;
  const lineRatio = lineScore.validCount / total;

  const wordLooksGood = wordRatio >= 0.7 && wordScore.monotonicBreaks <= 1;
  const lineLooksGood = lineRatio >= 0.7 && lineScore.monotonicBreaks <= 1;

  if (wordLooksGood && (!lineLooksGood || wordScore.monotonicBreaks <= lineScore.monotonicBreaks)) {
    return { source: 'words', timings: wordTimings, score: wordScore };
  }

  if (lineLooksGood || lineRatio >= wordRatio) {
    return { source: 'lines', timings: lineTimings, score: lineScore };
  }

  return { source: 'words', timings: wordTimings, score: wordScore };
}

function inferScale(times: number[], durationS?: number): number {
  const maxTime = Math.max(...times);

  if (!isFiniteNumber(durationS) || durationS <= 0 || !isFiniteNumber(maxTime)) {
    if (maxTime > 10000) {
      return 0.001;
    }
    if (maxTime > 1000) {
      return 0.001;
    }
    return 1;
  }

  const candidates = [1, 0.1, 0.01, 0.001, 10, 100];
  let bestScale = 1;
  let bestDiff = Number.POSITIVE_INFINITY;

  candidates.forEach((scale) => {
    const diff = Math.abs(maxTime * scale - durationS) / durationS;
    if (diff < bestDiff) {
      bestDiff = diff;
      bestScale = scale;
    }
  });

  return bestDiff <= 0.25 ? bestScale : 1;
}

function parseDurationFormatted(value: string): number | undefined {
  const parts = value.trim().split(':').map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) {
    return undefined;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return undefined;
}

function extractDurationSeconds(source: any): number | undefined {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  const candidates = [
    source.duration_s,
    source.duration,
    source.metadata?.duration,
    source.metadata?.duration_s
  ];

  for (const candidate of candidates) {
    if (isFiniteNumber(candidate)) {
      return candidate;
    }
  }

  if (typeof source.metadata?.duration_formatted === 'string') {
    return parseDurationFormatted(source.metadata.duration_formatted);
  }

  return undefined;
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

function normalizeTimings(lines: RawLineTiming[], durationS?: number): LineTiming[] {
  const times = lines.reduce<number[]>((acc, line) => {
    if (isFiniteNumber(line.start_s)) {
      acc.push(line.start_s);
    }
    if (isFiniteNumber(line.end_s)) {
      acc.push(line.end_s);
    }
    return acc;
  }, []);

  if (times.length === 0) {
    return [];
  }

  const scale = inferScale(times, durationS);
  const scaledLines = lines.map((line) => ({
    text: line.text,
    start_s: isFiniteNumber(line.start_s) ? line.start_s * scale : undefined,
    end_s: isFiniteNumber(line.end_s) ? line.end_s * scale : undefined
  }));

  const starts = scaledLines.map((line) => line.start_s).filter(isFiniteNumber);
  const minStart = starts.length > 0 ? Math.min(...starts) : 0;
  const offset = minStart < 0 ? -minStart : 0;

  const durations = scaledLines
    .map((line) =>
      isFiniteNumber(line.start_s) && isFiniteNumber(line.end_s)
        ? line.end_s - line.start_s
        : undefined
    )
    .filter((duration): duration is number => isFiniteNumber(duration) && duration > 0);
  const fallbackDuration = durations.length > 0 ? median(durations) : 2.5;

  const normalized: LineTiming[] = [];
  let lastStart = 0;

  for (let index = 0; index < scaledLines.length; index += 1) {
    const line = scaledLines[index];
    const text = line.text;
    const rawStart = isFiniteNumber(line.start_s) ? line.start_s + offset : undefined;
    let start = isFiniteNumber(rawStart) ? rawStart : lastStart;
    if (start < lastStart) {
      start = lastStart;
    }

    let end = isFiniteNumber(line.end_s) ? line.end_s + offset : undefined;
    if (!isFiniteNumber(end) || end <= start) {
      let nextStart: number | undefined;
      for (let nextIndex = index + 1; nextIndex < scaledLines.length; nextIndex += 1) {
        const candidateStart = scaledLines[nextIndex].start_s;
        if (isFiniteNumber(candidateStart)) {
          nextStart = candidateStart + offset;
          break;
        }
      }

      if (isFiniteNumber(nextStart) && nextStart > start) {
        end = nextStart;
      } else {
        end = start + fallbackDuration;
      }
    }

    if (isFiniteNumber(durationS)) {
      if (start > durationS) {
        start = durationS;
      }
      if (end > durationS) {
        end = durationS;
      }
    }

    if (end < start + 0.02) {
      end = start + 0.02;
    }

    normalized.push({
      text,
      start_s: roundToMillis(start),
      end_s: roundToMillis(end)
    });
    lastStart = start;
  }

  return normalized;
}

function parsePromptLines(prompt: string): string[] {
  return prompt
    .split(/\r?\n/)
    .map((line) => sanitizeLyricText(line))
    .filter((line) => line.length > 0);
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

function repairMissingPromptLines(
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
      target.push({
        text: missingLines[missingLines.length - 1],
        start_s: Math.max(0, windowEnd - minimumDuration)
      });
      return 1;
    }

    const expectedDurations = missingLines.map((line) =>
      Math.max(minimumDuration, estimateMissingLineDuration(line, secondsPerUnit))
    );

    let totalDuration = expectedDurations.reduce((acc, duration) => acc + duration, 0);
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

function buildAlignedLyricsTimings(
  alignedLyrics: AlignedLine[],
  durationS?: number,
  waveformData?: number[]
): {
  lines: LineTiming[];
  source: 'words' | 'lines';
  score: TimingScore;
  scale: number;
  usedRelativeExpansion: boolean;
  relativeMethod: 'none' | 'linear' | 'waveform';
} {
  const wordTimings = deriveTimingsFromWords(alignedLyrics);
  const lineTimings = deriveTimingsFromLines(alignedLyrics);
  const chosen = chooseTimingSource(wordTimings, lineTimings);

  let baseTimings = chosen.timings;
  const usedRelativeExpansion = looksLikeRelativeLineTimings(baseTimings, durationS);
  let relativeMethod: 'none' | 'linear' | 'waveform' = 'none';
  if (usedRelativeExpansion) {
    if (isFiniteNumber(durationS) && durationS > 0) {
      const aligned = alignRelativeTimingsWithWaveform(baseTimings, durationS, waveformData);
      baseTimings = aligned.lines;
      relativeMethod = aligned.usedWaveform ? 'waveform' : 'linear';
    } else {
      baseTimings = expandRelativeTimings(baseTimings, durationS);
      relativeMethod = 'linear';
    }
  }

  const allTimes = baseTimings.reduce<number[]>((acc, line) => {
    if (isFiniteNumber(line.start_s)) {
      acc.push(line.start_s);
    }
    if (isFiniteNumber(line.end_s)) {
      acc.push(line.end_s);
    }
    return acc;
  }, []);
  const scale = allTimes.length > 0 ? inferScale(allTimes, durationS) : 1;
  const normalized = normalizeTimings(baseTimings, durationS);

  return {
    lines: normalized,
    source: chosen.source,
    score: chosen.score,
    scale,
    usedRelativeExpansion,
    relativeMethod
  };
}

function injectStyles() {
  console.info('[SunoLyric] 🎨 Checking if styles are already injected...');
  if (document.getElementById('suno-lyric-downloader-styles')) {
    console.info('[SunoLyric] ✅ Styles already exist, skipping injection');
    return;
  }
  console.info('[SunoLyric] 📝 Injecting CSS styles...');
  const style = document.createElement('style');
  style.id = 'suno-lyric-downloader-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
  console.info('[SunoLyric] ✅ Styles injected successfully');
}

function getCookie(name: string): string | undefined {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  // Handle multiple cookies with the same name - take the last one (most recent)
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    return lastPart.split(';').shift();
  }

  return undefined;
}

async function fetchClipMetadata(songId: string, token: string): Promise<ClipMetadata | null> {
  try {
    const clipResponse = await fetch(`${API_BASE_URL}/clip/${songId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!clipResponse.ok) {
      return null;
    }

    return await clipResponse.json();
  } catch (error) {
    console.error('[SunoLyric] ❌ Error fetching clip metadata:', error);
    return null;
  }
}

async function fetchLyrics(songId: string, token: string): Promise<LyricsData | null> {
  console.info(`[SunoLyric] 🎵 Fetching lyrics for song: ${songId}`);
  if (lyricsCache.has(songId)) {
    console.info(`[SunoLyric] ♻️ Using cached lyrics for ${songId}`);
    return lyricsCache.get(songId)!;
  }

  try {
    let clipData: ClipMetadata | null = null;
    const ensureClipData = async () => {
      if (clipData) {
        return clipData;
      }
      clipData = await fetchClipMetadata(songId, token);
      return clipData;
    };

    // 1. Try fetching aligned lyrics first
    console.info(`[SunoLyric] 📡 Fetching aligned lyrics from API...`);
    const alignedResponse = await fetch(`${GEN_API_URL}/${songId}/aligned_lyrics/v2/`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (alignedResponse.ok) {
      const data: ApiResponse = await alignedResponse.json();

      const alignedLyrics = Array.isArray(data.aligned_lyrics)
        ? data.aligned_lyrics
        : Array.isArray((data as any)?.data?.aligned_lyrics)
          ? (data as any).data.aligned_lyrics
          : [];
      const waveformData = Array.isArray(data.waveform_data)
        ? data.waveform_data
        : Array.isArray((data as any)?.data?.waveform_data)
          ? (data as any).data.waveform_data
          : undefined;

      if (alignedLyrics.length > 0) {
        let durationS = extractDurationSeconds(data);
        if (!isFiniteNumber(durationS)) {
          const clip = await ensureClipData();
          durationS = extractDurationSeconds(clip);
        }

        const timingResult = buildAlignedLyricsTimings(alignedLyrics, durationS, waveformData);
        console.info(
          `[SunoLyric] ⏱️ Timing source: ${timingResult.source}, valid=${timingResult.score.validCount}/${alignedLyrics.length}, breaks=${timingResult.score.monotonicBreaks}`
        );
        console.info(
          `[SunoLyric] ⏱️ Duration=${isFiniteNumber(durationS) ? durationS.toFixed(2) + 's' : 'n/a'}, scale=${timingResult.scale}, relative=${timingResult.usedRelativeExpansion}, method=${timingResult.relativeMethod}`
        );

        let repairedLines = timingResult.lines;
        let insertedCount = 0;
        const clip = await ensureClipData();
        const repairResult = repairMissingPromptLines(
          timingResult.lines,
          clip?.metadata?.prompt,
          durationS
        );
        repairedLines = repairResult.lines;
        insertedCount = repairResult.insertedCount;

        if (repairedLines.length > 0) {
          console.info(
            `[SunoLyric] ✅ Found aligned lyrics: ${repairedLines.length} lines${insertedCount > 0 ? ` (+${insertedCount} repaired from prompt)` : ''}`
          );
          const lyricsData: LyricsData = { type: 'aligned', data: repairedLines };
          lyricsCache.set(songId, lyricsData);
          return lyricsData;
        }
      }
    }

    // 2. Fallback to clip metadata for plain lyrics
    const fallbackClip = await ensureClipData();
    if (fallbackClip) {
      const prompt = fallbackClip.metadata?.prompt;
      if (prompt) {
        const lyricsData: LyricsData = { type: 'plain', data: prompt };
        lyricsCache.set(songId, lyricsData);
        return lyricsData;
      }
    }

    console.info(`[SunoLyric] ⚠️ No lyrics found for song ${songId}`);
    return null;
  } catch (error) {
    console.error('[SunoLyric] ❌ Error fetching lyrics:', error);
    return null;
  }
}

function createButton(text: string, onClick: (e: MouseEvent) => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.innerText = text;
  button.className = 'suno-lyric-downloader-btn';
  button.addEventListener('click', onClick);
  return button;
}

function downloadFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function createToolsOverlay(songId: string, lyrics: LyricsData): HTMLElement {
  const isAligned = lyrics.type === 'aligned';
  let currentFileType: FileType = 'lrc';

  const toolsBox = document.createElement('div');
  toolsBox.className = 'suno-lyric-downloader-overlay';
  // Mark this container to prevent duplicates
  toolsBox.dataset.sunoLyricDownloader = 'true';

  const getDownloadText = (type: FileType) => chrome.i18n.getMessage('download_lyric', [type.toUpperCase()]) || `Download ${type.toUpperCase()}`;

  const getToggleText = (type: FileType) => {
    const nextType = type === 'lrc' ? 'SRT' : 'LRC';
    return chrome.i18n.getMessage('toggle_type', [nextType]) || `Switch to ${nextType}`;
  };

  const downloadButton = createButton(
    getDownloadText(currentFileType),
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Only use aligned words data - no fake timestamps
      const alignedLines = lyrics.data as LineTiming[];
      const content = currentFileType === 'srt' ? convertToSRT(alignedLines) : convertToLRC(alignedLines);

      const extName = chrome.i18n.getMessage('extension_name') || 'SunoLyric';
      const fileName = `${songId}-lyrics-${extName.toLowerCase().replace(/\s+/g, '-')}.${currentFileType}`;

      downloadFile(content, fileName, `text/${currentFileType}`);
    }
  );

  const toggleButton = createButton(
    getToggleText(currentFileType),
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      currentFileType = currentFileType === 'lrc' ? 'srt' : 'lrc';

      downloadButton.innerText = getDownloadText(currentFileType);
      toggleButton.innerText = getToggleText(currentFileType);
    }
  );

  toolsBox.appendChild(toggleButton);
  toolsBox.appendChild(downloadButton);
  return toolsBox;
}

function convertToSRT(alignedLines: LineTiming[]): string {
  return alignedLines
    .map((line, index) => {
      const startTime = formatSRTTime(line.start_s);
      const endTime = formatSRTTime(line.end_s);
      return `${index + 1}\n${startTime} --> ${endTime}\n${line.text}\n`;
    })
    .join('\n');
}

function convertToLRC(alignedLines: LineTiming[]): string {
  return alignedLines
    .map(line => `${formatLRCTime(line.start_s)}${line.text}`)
    .join('\n');
}

function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

function formatLRCTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds % 1) * 100);

  return `[${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}]`;
}

// This function has been removed because it generated inaccurate timestamps.
// We now only provide SRT/LRC downloads for songs with actual aligned_words data.

function getSongIdFromUrl(): string {
  const path = window.location.pathname;
  if (path.startsWith('/song/')) {
    return path.split('/').pop() || '';
  }
  return '';
}

async function processPage() {
  console.info('[SunoLyric] 🔄 processPage() called');

  const songId = getSongIdFromUrl();
  console.info(`[SunoLyric] 🆔 Song ID from URL: "${songId}"`);

  if (!songId) {
    console.info('[SunoLyric] ⚠️ No song ID found, exiting');
    return;
  }

  // Find the image container using the alt attribute which is more reliable.
  // The song cover image has alt="Song Cover Image" in Suno's current DOM structure.
  const selector = `img[alt="Song Cover Image"].w-full.h-full`;
  console.info(`[SunoLyric] 🔍 Looking for images with selector: "${selector}"`);
  const imageElements = document.querySelectorAll<HTMLImageElement>(selector);
  console.info(`[SunoLyric] 📸 Found ${imageElements.length} matching image(s)`);

  if (!imageElements.length) {
    console.info('[SunoLyric] ❌ No matching images found, exiting');
    return;
  }

  // Debug: Show all available cookies
  const allCookies = document.cookie;
  console.info(`[SunoLyric] 🍪 All cookies: "${allCookies}"`);

  const sessionToken = getCookie('__session');
  console.info(`[SunoLyric] 🔑 Session token (__session): ${sessionToken ? '✅ Found' : '❌ Missing'}`);

  if (!sessionToken) {
    console.info('[SunoLyric] ⚠️ No session token, cannot fetch lyrics');
    console.info('[SunoLyric] 💡 Please make sure you are logged in to Suno.com');
    return;
  }

  // Fetch lyrics (cached if available)
  console.info('[SunoLyric] 📥 Fetching lyrics...');
  const lyrics = await fetchLyrics(songId, sessionToken);

  if (!lyrics) {
    console.info('[SunoLyric] ❌ No lyrics data returned, exiting');
    return;
  }

  console.info(`[SunoLyric] 📄 Lyrics type: ${lyrics.type}`);

  // Only show download buttons for aligned lyrics with accurate timestamps
  if (lyrics.type !== 'aligned') {
    console.info(`[SunoLyric] ⚠️ Song ${songId} has plain lyrics only (no timestamps), skipping UI`);
    return;
  }

  console.info(`[SunoLyric] 🎯 Processing ${imageElements.length} image element(s)...`);

  imageElements.forEach((imageElement, index) => {
    console.info(`[SunoLyric] 🖼️ Processing image #${index + 1}`);

    const parent = imageElement.parentElement;
    if (!parent) {
      console.info(`[SunoLyric] ⚠️ Image #${index + 1} has no parent, skipping`);
      return;
    }
    console.info(`[SunoLyric] ✅ Image #${index + 1} parent found: ${parent.tagName}.${parent.className}`);

    // Check if we already injected the tools
    const existing = parent.querySelector('.suno-lyric-downloader-overlay');
    if (existing) {
      console.info(`[SunoLyric] ♻️ Buttons already injected for image #${index + 1}, skipping`);
      return;
    }

    // Ensure parent has relative positioning for absolute child
    const computedStyle = window.getComputedStyle(parent);
    console.info(`[SunoLyric] 📐 Parent position: ${computedStyle.position}`);

    if (computedStyle.position === 'static') {
      console.info('[SunoLyric] 🔧 Setting parent position to relative');
      parent.style.position = 'relative';
    }

    console.info(`[SunoLyric] 🎨 Creating and appending button overlay for image #${index + 1}...`);
    parent.appendChild(createToolsOverlay(songId, lyrics));
    console.info(`[SunoLyric] ✅ Buttons injected successfully for image #${index + 1}!`);
  });

  console.info('[SunoLyric] 🎉 processPage() completed!');
}

// Debounce function to limit how often processPage runs
function debounce(func: Function, wait: number) {
  let timeout: any;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const debouncedProcessPage = debounce(processPage, 500);

function initObserver() {
  console.info('[SunoLyric] 🚀 Initializing extension...');
  injectStyles();

  // Initial check
  console.info('[SunoLyric] 🏁 Running initial page check...');
  processPage();

  const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        shouldProcess = true;
        break;
      }
      // Also check for attribute changes if needed, e.g., src changes
      if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
        shouldProcess = true;
        break;
      }
    }

    if (shouldProcess) {
      console.info('[SunoLyric] 👀 DOM mutation detected, triggering processPage (debounced)');
      debouncedProcessPage();
    }
  });

  console.info('[SunoLyric] 👁️ Setting up MutationObserver...');
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'] // Only watch src changes for images
  });
  console.info('[SunoLyric] ✅ MutationObserver active');
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message) => {
  console.info(`[SunoLyric] 📬 Message received:`, message);
  if (message.action === "URL_CHANGED") {
    console.info('[SunoLyric] 🔄 URL changed, triggering processPage (debounced)');
    debouncedProcessPage();
  } else if (message.action === "MANUALLY_TRIGGER") {
    console.info('[SunoLyric] 🔧 Manual trigger, running processPage immediately');
    processPage();
  }
  return false;
});

// Start
console.info('[SunoLyric] 🎬 Content script loaded!');
console.info(`[SunoLyric] 📄 Document readyState: ${document.readyState}`);

if (document.readyState === 'loading') {
  console.info('[SunoLyric] ⏳ Waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.info('[SunoLyric] ✅ DOMContentLoaded fired!');
    initObserver();
  });
} else {
  console.info('[SunoLyric] ➡️ DOM already loaded, initializing immediately');
  initObserver();
}
