/* SatoshiShrine semantic core -- the ONE place the held vectors are loaded and ranked.
 *
 * Written 2026-08-26 after /checkup/ shipped with its own copy of this logic and was broken
 * three ways at once: it imported the runtime from the wrong directory, it read the shards'
 * quantised {id, q8, scale} vectors as float arrays so every comparison scored NaN, and it
 * therefore reported a textbook MiCA passage as having nothing close in the held corpus. A
 * false absence is the one failure this archive exists to avoid, and it reached production
 * because nothing forced the copy and the original to agree.
 *
 * Any page that ranks held text imports THIS module. Two consumers today: the front page's
 * search runtime and /checkup/. tests/check_single_semantic_core.py fails the build if a
 * third one reimplements the recovery.
 */

// The model, and where its files are. Local only: a remote model would be a different
// tokenizer producing vectors that do not live in the same space as the corpus, and the
// ranking would be quietly meaningless rather than visibly broken.
const MODEL = 'Xenova/all-MiniLM-L6-v2';
const RUNTIME = '/semantic/vendor/transformers.min.js';
const MODELS = '/semantic/models/';
const WASM = '/semantic/vendor/';

// The similarity below which the corpus is reported as holding nothing close. Shared, so the
// two pages cannot disagree about what "close" means.
export const FLOOR = 0.43;

let api = null;
let extractor = null;

export async function loadExtractor() {
  api ??= await import(RUNTIME);
  if (!api?.pipeline || !api?.env) {
    throw new Error('The local semantic runtime did not load. No remote fallback is used.');
  }
  api.env.allowRemoteModels = false;
  api.env.allowLocalModels = true;
  api.env.useBrowserCache = false;
  api.env.localModelPath = MODELS;
  api.env.backends.onnx.wasm.wasmPaths = WASM;
  api.env.backends.onnx.wasm.numThreads = 1;
  extractor ??= await api.pipeline('feature-extraction', MODEL, { quantized: true });
  return extractor;
}

/** Recover one shard's int8 vectors to floats. The shard format is {id, q8:[...], scale}. */
export function recover(vectors) {
  return vectors.map(vector => vector.q8.map(value => value * vector.scale));
}

/** Fetch shards and return {chunks, vectors} with vectors already recovered and aligned. */
export async function loadCorpus(paths) {
  const parts = await Promise.all(paths.map(path => fetch(path).then(response => {
    if (!response.ok) throw new Error('The local held-source vector shard is unavailable.');
    return response.json();
  })));
  const chunks = parts.flatMap(part => part.chunks);
  const vectors = parts.flatMap(part => recover(part.vectors));
  if (chunks.length !== vectors.length) {
    throw new Error(`the held-source shards do not line up: ${chunks.length} passages ` +
                    `against ${vectors.length} vectors`);
  }
  return { chunks, vectors };
}

/**
 * Score one normalised query against recovered held vectors, best first.
 * The query arrives normalised from the extractor, so dividing by the held vector's
 * magnitude alone is the cosine.
 */
export function rank(query, vectors) {
  return vectors
    .map((vector, index) => {
      let dot = 0, magnitude = 0;
      for (let position = 0; position < vector.length; position++) {
        dot += vector[position] * query[position];
        magnitude += vector[position] * vector[position];
      }
      return { index, score: dot / Math.max(Math.sqrt(magnitude), 1e-12) };
    })
    .sort((a, b) => b.score - a.score);
}

/** Embed one passage and return its vector as a plain array. */
export async function embed(text) {
  const output = await (await loadExtractor())(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}
