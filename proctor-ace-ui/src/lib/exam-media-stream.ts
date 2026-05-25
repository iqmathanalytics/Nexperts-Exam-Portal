let sharedStream: MediaStream | null = null;

export async function acquireExamCamera(): Promise<MediaStream> {
  if (sharedStream?.active) {
    const track = sharedStream.getVideoTracks()[0];
    if (track?.readyState === "live") return sharedStream;
  }
  sharedStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  return sharedStream;
}

export function getExamCameraStream(): MediaStream | null {
  return sharedStream?.active ? sharedStream : null;
}

export function releaseExamCamera() {
  sharedStream?.getTracks().forEach((t) => t.stop());
  sharedStream = null;
}

export async function enterFullscreen(): Promise<boolean> {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
    return Boolean(document.fullscreenElement);
  } catch {
    return false;
  }
}
