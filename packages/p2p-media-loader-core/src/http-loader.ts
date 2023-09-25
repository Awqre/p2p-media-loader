import { RequestAbortError, FetchError } from "./errors";
import { Segment } from "./types";
import { HttpRequest, LoadProgress } from "./request";

export function getHttpSegmentRequest(segment: Segment): Readonly<HttpRequest> {
  const { promise, abortController, progress, startTimestamp } =
    fetchSegmentData(segment);
  return {
    type: "http",
    promise,
    progress,
    startTimestamp,
    abort: () => abortController.abort(),
  };
}

function fetchSegmentData(segment: Segment) {
  const headers = new Headers();
  const { url, byteRange, localId: segmentId } = segment;

  if (byteRange) {
    const { start, end } = byteRange;
    const byteRangeString = `bytes=${start}-${end}`;
    headers.set("Range", byteRangeString);
  }
  const abortController = new AbortController();

  let progress: LoadProgress | undefined;
  const loadSegmentData = async () => {
    try {
      const response = await window.fetch(url, {
        headers,
        signal: abortController.signal,
      });

      if (response.ok) {
        const result = getDataPromiseAndMonitorProgress(response);
        if (!result) return response.arrayBuffer();
        progress = result.progress;
        return result.dataPromise;
      }
      throw new FetchError(
        response.statusText ?? `Network response was not for ${segmentId}`,
        response.status,
        response
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new RequestAbortError(`Segment fetch was aborted ${segmentId}`);
      }
      throw error;
    }
  };

  return {
    promise: loadSegmentData(),
    abortController,
    progress,
    startTimestamp: performance.now(),
  };
}

function getDataPromiseAndMonitorProgress(response: Response):
  | {
      progress: LoadProgress;
      dataPromise: Promise<ArrayBuffer>;
    }
  | undefined {
  const totalBytesString = response.headers.get("Content-Length");
  if (totalBytesString === null || !response.body) return;

  const totalBytes = +totalBytesString;
  const progress: LoadProgress = {
    percent: 0,
    loadedBytes: 0,
    totalBytes,
  };
  const reader = response.body.getReader();

  const getDataPromise = async () => {
    const chunks: Uint8Array[] = [];
    for await (const chunk of readStream(reader)) {
      chunks.push(chunk);
      progress.loadedBytes += chunk.length;
      progress.percent = (progress.loadedBytes / totalBytes) * 100;
    }

    const resultBuffer = new ArrayBuffer(progress.loadedBytes);
    const view = new Uint8Array(resultBuffer);

    let offset = 0;
    for (const chunk of chunks) {
      view.set(chunk, offset);
      offset += chunk.length;
    }

    return resultBuffer;
  };
  return { progress, dataPromise: getDataPromise() };
}

async function* readStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<Uint8Array> {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield value;
  }
}
