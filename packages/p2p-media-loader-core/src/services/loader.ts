import { StreamsContainer } from "./streams-container";
import { Segment } from "../types";

export class Loader {
  container: StreamsContainer;
  segmentRequestContext = new Map<string, RequestContext>();

  constructor(container: StreamsContainer) {
    this.container = container;
  }

  loadSegment(segmentId: string) {
    const segment = this.container.getSegment(segmentId);
    if (!segment) return;

    return this.fetchSegment(segment);
  }

  abortSegment(segmentId: string) {
    const requestContext = this.segmentRequestContext.get(segmentId);
    if (!requestContext) return;
    requestContext.abortController.abort();
  }

  private async fetchSegment(segment: Segment) {
    const headers = new Headers();
    const { url, byteRange } = segment;

    if (byteRange) {
      const { start, end } = byteRange;
      const byteRangeString = `bytes=${start}-${end - 1}`;
      headers.set("Range", byteRangeString);
    }
    const requestContext = new RequestContext();
    this.segmentRequestContext.set(segment.localId, requestContext);
    const response = await fetch(url, {
      headers,
      signal: requestContext.abortController.signal,
    });
    if (!response.ok) {
      throw new FetchError(
        response.statusText ?? "Fetch, bad network response",
        response.status,
        response
      );
    }
    const data = await response.arrayBuffer();
    return {
      ok: response.ok,
      status: response.status,
      data,
      url: response.url,
    };
  }
}

class RequestContext {
  abortController = new AbortController();
}

export class FetchError extends Error {
  public code: number;
  public details: object;

  constructor(message: string, code: number, details: object) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
