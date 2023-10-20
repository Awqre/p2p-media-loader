export enum PeerCommandType {
  SegmentsAnnouncement,
  SegmentRequest,
  SegmentData,
  SegmentAbsent,
  CancelSegmentRequest,
  HttpLoadIntent,
}

export enum PeerSegmentStatus {
  Loaded,
  LoadingByHttp,
}
