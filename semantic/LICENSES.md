# Semantic retrieval assets

The browser feature-extraction model is **Xenova/all-MiniLM-L6-v2**, distributed under the Apache-2.0 license. The model and tokenizer files are vendored for local static use; the browser does not request a hosted model or send queries to a model API.

The browser runtime is **Xenova Transformers.js 2.17.2** and ONNX Runtime Web/WASM 1.17.1. These files are vendored into the static deployment solely to run feature extraction in the reader’s browser.
