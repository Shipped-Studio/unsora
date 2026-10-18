import OpenAI from "openai";
import fs from "fs";
import path from "path";

/**
 * The ffmpeg-based functions below run in Trigger.dev workers ONLY — the
 * `ffmpeg()` build extension provides the binary there. The Express API has
 * no ffmpeg; it only uses the pure-JS helpers (groupWordsIntoChunks). ffmpeg
 * is required lazily so importing this module never loads fluent-ffmpeg.
 */
function getFfmpeg() {
  const { ffmpeg } =
    require("./ffmpeg-config") as typeof import("./ffmpeg-config");
  return ffmpeg;
}

// Lazy singleton — constructing OpenAI at module scope throws "Missing
// credentials" when OPENAI_API_KEY isn't present at import time (e.g. during
// Trigger.dev's task-indexing step at deploy). Build it on first use instead.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export interface WordTimestamp {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

export interface TranscriptionSegment {
  text: string;
  start: number;
  end: number;
  words: WordTimestamp[];
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  language: string;
  duration: number;
}

/* -----------------------------------------------------------
 *  Extract audio from video -> WAV (pcm_s16le)
 *  SUPER FAST + MAX CPU + Whisper optimal + safe under 25MB
 * ---------------------------------------------------------- */
export async function extractAudioFromVideo(
  videoPath: string,
  audioPath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    getFfmpeg()(videoPath)
      .inputOptions(["-threads 0"])
      .noVideo()
      .audioCodec("pcm_s16le")
      .audioChannels(1)
      .audioFrequency(16000)
      .outputOptions(["-threads 0"])
      .output(audioPath)
      .on("start", (cmd) => console.log("FFmpeg START:", cmd))
      .on("error", (err) => {
        console.error("FFmpeg ERROR:", err);
        reject(err);
      })
      .on("end", () => {
        console.log("FFmpeg FINISHED");
        resolve(audioPath);
      })
      .run();
  });
}

/* -----------------------------------------------------------
 *  Get video duration using ffprobe
 * ---------------------------------------------------------- */
export async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    getFfmpeg().ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

/* -----------------------------------------------------------
 *  Get video width & height
 * ---------------------------------------------------------- */
export async function getVideoDimensions(
  videoPath: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    getFfmpeg().ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);

      const stream = metadata.streams.find((s) => s.codec_type === "video");

      if (!stream || !stream.width || !stream.height) {
        return reject(new Error("Could not extract video dimensions"));
      }

      resolve({
        width: stream.width,
        height: stream.height,
      });
    });
  });
}

/* -----------------------------------------------------------
 *   Transcribe audio with Whisper-1 (word + segment timestamps)
 * ---------------------------------------------------------- */
export async function transcribeAudio(
  audioPath: string,
  language?: string
): Promise<TranscriptionResult> {
  let audioFile: fs.ReadStream | null = null;

  try {
    // Safety: must be under 25MB
    const stats = fs.statSync(audioPath);
    if (stats.size > 25 * 1024 * 1024) {
      throw new Error("Audio too large (>25MB) for OpenAI Whisper API.");
    }

    audioFile = fs.createReadStream(audioPath);

    const response: any = await getOpenAI().audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word", "segment"],
      // ISO-639-1 code; omitting lets Whisper auto-detect
      ...(language ? { language } : {}),
    });

    // Close the stream immediately after use
    if (audioFile) {
      audioFile.destroy();
      audioFile = null;
    }

    // Top-level words
    const allWords: WordTimestamp[] = (response.words || []).map((w: any) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    }));

    console.log(`Extracted ${allWords.length} words from Whisper response`);

    // Segment → include words
    // Each word goes to the segment it starts in. Matching on both ends
    // dropped words that straddle a segment boundary.
    const rawSegments: any[] = response.segments || [];
    const segments: TranscriptionSegment[] = rawSegments.map(
      (seg: any, i: number) => {
        const next = rawSegments[i + 1];
        const segmentWords = allWords.filter(
          (w) =>
            (i === 0 || w.start >= seg.start) &&
            (!next || w.start < next.start)
        );

        return {
          text: seg.text,
          start: seg.start,
          end: seg.end,
          words: segmentWords,
        };
      }
    );

    return {
      text: response.text,
      segments,
      language: response.language || "en",
      duration: response.duration || 0,
    };
  } catch (error) {
    console.error("Transcription error:", error);
    // Ensure stream is closed on error
    if (audioFile) {
      audioFile.destroy();
    }
    throw error;
  }
}

/* -----------------------------------------------------------
 *   Full video → transcription pipeline
 * ---------------------------------------------------------- */
export async function transcribeVideo(
  videoPath: string,
  language?: string
): Promise<TranscriptionResult> {
  const tempDir = path.join(process.cwd(), "temp");

  // Ensure temp directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // WAV output (small enough for Whisper)
  const audioPath = path.join(
    tempDir,
    `audio_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`
  );

  try {
    console.log("Extracting audio from video...");
    await extractAudioFromVideo(videoPath, audioPath);

    console.log("Reading video duration...");
    const duration = await getVideoDuration(videoPath);

    console.log("Transcribing audio...");
    const transcription = await transcribeAudio(audioPath, language);

    if (!transcription.duration) {
      transcription.duration = duration;
    }

    return transcription;
  } finally {
    // Cleanup temp WAV file
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
  }
}

/* -----------------------------------------------------------
 *  Utility: Split words into caption lines
 * ---------------------------------------------------------- */
// Speech is cut into phrases at sentence ends and pauses, then each phrase
// is broken into lines of similar length that fit a vertical video, the way
// a text layout balances a paragraph. Commas are preferred break points.
const MAX_LINE_CHARS = 18;
const MAX_LINE_SECONDS = 2.2;
const PAUSE_SECONDS = 0.5;
const SENTENCE_END = /[.!?…]/;
const CLAUSE_END = /[,;:—–]/;

// Line costs, weighed against the squared space left on each line.
const COMMA_BREAK_BONUS = 60;
const COMMA_INSIDE_COST = 80;
const SINGLE_WORD_COST = 60;
const LEADING_WORD_COST = 150;

// Words that read badly at the end of a line; they belong with the next one.
const LEADING_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "so", "to", "of", "in", "on", "at",
  "for", "with", "from", "by", "as", "if", "my", "your", "our", "their",
  "his", "her", "its",
]);

const bare = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/**
 * Whisper's word timestamps carry no punctuation, but the full transcript
 * does. Walks both in order and returns the punctuation after each word
 * ("" when it can't be matched, e.g. languages written without spaces).
 */
function punctuationAfterWords(
  words: WordTimestamp[],
  transcript: string
): string[] {
  const tokens = transcript.split(/\s+/).filter(Boolean);
  let t = 0;
  return words.map((word) => {
    const target = bare(word.word);
    for (let k = t; k < Math.min(t + 5, tokens.length); k++) {
      if (bare(tokens[k]) === target) {
        t = k + 1;
        return tokens[k].match(/[^\p{L}\p{N}']+$/u)?.[0] ?? "";
      }
    }
    return "";
  });
}

interface CaptionWord {
  word: WordTimestamp;
  punctuation: string;
}

const lineLength = (line: CaptionWord[]) =>
  line.reduce((n, w) => n + w.word.word.trim().length, 0) + line.length - 1;

function lineCost(line: CaptionWord[], endsPhrase: boolean): number {
  const last = line[line.length - 1];
  const breaksAtComma = CLAUSE_END.test(last.punctuation);
  let cost = Math.max(0, MAX_LINE_CHARS - lineLength(line)) ** 2;
  if (breaksAtComma) cost -= COMMA_BREAK_BONUS;
  cost +=
    line.slice(0, -1).filter((w) => CLAUSE_END.test(w.punctuation)).length *
    COMMA_INSIDE_COST;
  if (line.length === 1 && !breaksAtComma) cost += SINGLE_WORD_COST;
  if (!endsPhrase && LEADING_WORDS.has(bare(last.word.word))) {
    cost += LEADING_WORD_COST;
  }
  return cost;
}

/** Breaks one phrase into the lines with the lowest total cost. */
function breakPhrase(phrase: CaptionWord[]): CaptionWord[][] {
  const n = phrase.length;
  const best = [0, ...Array<number>(n).fill(Infinity)];
  const lineStart = Array<number>(n + 1).fill(0);

  for (let end = 1; end <= n; end++) {
    for (let start = end - 1; start >= 0; start--) {
      const line = phrase.slice(start, end);
      const tooBig =
        lineLength(line) > MAX_LINE_CHARS ||
        line[line.length - 1].word.end - line[0].word.start > MAX_LINE_SECONDS;
      // A single word always fits; longer lines only grow from here.
      if (line.length > 1 && tooBig) break;
      const cost = best[start] + lineCost(line, end === n);
      if (cost < best[end]) {
        best[end] = cost;
        lineStart[end] = start;
      }
    }
  }

  const lines: CaptionWord[][] = [];
  for (let end = n; end > 0; end = lineStart[end]) {
    lines.unshift(phrase.slice(lineStart[end], end));
  }
  return lines;
}

export function splitIntoCaptionLines(
  words: WordTimestamp[],
  transcript = ""
): TranscriptionSegment[] {
  const punctuation = punctuationAfterWords(words, transcript);
  const phrases: CaptionWord[][] = [];
  let current: CaptionWord[] = [];

  words.forEach((word, i) => {
    const prev = current[current.length - 1];
    if (prev && word.start - prev.word.end >= PAUSE_SECONDS) {
      phrases.push(current);
      current = [];
    }
    current.push({ word, punctuation: punctuation[i] });
    if (SENTENCE_END.test(punctuation[i])) {
      phrases.push(current);
      current = [];
    }
  });
  if (current.length) phrases.push(current);

  return phrases.flatMap(breakPhrase).map((line) => ({
    text: line.map((w) => w.word.word).join(" "),
    start: line[0].word.start,
    end: line[line.length - 1].word.end,
    words: line.map((w) => w.word),
  }));
}

/* -----------------------------------------------------------
 *  Utility: Group words into subtitle chunks
 * ---------------------------------------------------------- */
// A silence gap this long between consecutive words starts a new chunk even
// if the word cap isn't reached, so subtitles don't linger through pauses.
const CHUNK_GAP_SECONDS = 1.5;

export function groupWordsIntoChunks(
  words: WordTimestamp[],
  maxWordsPerChunk: number = 5
): TranscriptionSegment[] {
  const chunks: TranscriptionSegment[] = [];
  let current: WordTimestamp[] = [];

  const flush = () => {
    if (!current.length) return;
    chunks.push({
      text: current.map((w) => w.word).join(" "),
      start: current[0].start,
      end: current[current.length - 1].end,
      words: current,
    });
    current = [];
  };

  for (const word of words) {
    const prev = current[current.length - 1];
    if (
      current.length >= maxWordsPerChunk ||
      (prev && word.start - prev.end >= CHUNK_GAP_SECONDS)
    ) {
      flush();
    }
    current.push(word);
  }
  flush();

  return chunks;
}
