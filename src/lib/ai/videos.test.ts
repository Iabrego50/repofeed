import { describe, expect, it, vi } from "vitest";
import {
  OPENAI_VIDEOS_SHUTDOWN_MESSAGE,
  createXaiVideo,
  getVideoProvider,
  retrieveXaiVideo,
  videoProviderId,
} from "./videos";

describe("video provider adapter", () => {
  it("defaults to xAI and keeps OpenAI as a disabled adapter", async () => {
    expect(videoProviderId({})).toBe("xai");
    expect(videoProviderId({ VIDEO_PROVIDER: "xai" })).toBe("xai");
    expect(videoProviderId({ VIDEO_PROVIDER: "openai" })).toBe("openai");
    const openai = getVideoProvider({ VIDEO_PROVIDER: "openai" });
    expect(openai.id).toBe("openai");
    await expect(openai.create({ prompt: "test" })).rejects.toThrow(
      OPENAI_VIDEOS_SHUTDOWN_MESSAGE,
    );
  });

  it("creates an async xAI job with 9:16 image-to-video and retries 429", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        calls += 1;
        if (calls < 2) {
          return new Response(
            JSON.stringify({ error: { message: "slow down" } }),
            {
              status: 429,
              headers: { "retry-after": "0" },
            },
          );
        }
        expect(String(input)).toBe("https://api.x.ai/v1/videos/generations");
        expect(init?.method).toBe("POST");
        const headers = new Headers(init?.headers);
        expect(headers.get("Authorization")).toBe("Bearer xai-test");
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({
          model: "grok-imagine-video-1.5-lite",
          prompt: "animate the painted still",
          duration: 5,
          aspect_ratio: "9:16",
          resolution: "720p",
          generate_audio: false,
          image: { url: "https://proj.supabase.co/art.png" },
        });
        return new Response(JSON.stringify({ request_id: "req_9" }), {
          status: 200,
        });
      },
    );

    const job = await createXaiVideo(
      {
        prompt: "animate the painted still",
        seconds: 5,
        resolution: "720p",
        aspectRatio: "9:16",
        imageUrl: "https://proj.supabase.co/art.png",
      },
      { XAI_API_KEY: "xai-test" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(job).toMatchObject({ id: "req_9", status: "queued" });
    expect(calls).toBe(2);
  });

  it("maps xAI pending and done poll payloads", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          status: "pending",
          progress: 40,
          model: "grok-imagine-video-1.5-lite",
        }),
        { status: 200 },
      );
    });
    const pending = await retrieveXaiVideo(
      "req_1",
      { XAI_API_KEY: "xai-test" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(pending).toMatchObject({
      id: "req_1",
      status: "in_progress",
      progress: 40,
    });

    const doneFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          status: "done",
          model: "grok-imagine-video-1.5-lite",
          video: {
            url: "https://vidgen.x.ai/clip.mp4",
            duration: 5,
            respect_moderation: true,
          },
        }),
        { status: 200 },
      );
    });
    const done = await retrieveXaiVideo(
      "req_1",
      { XAI_API_KEY: "xai-test" },
      doneFetch as unknown as typeof fetch,
    );
    expect(done).toMatchObject({
      id: "req_1",
      status: "completed",
      videoUrl: "https://vidgen.x.ai/clip.mp4",
    });
  });

  it("fails a done job with no URL or failed moderation", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          status: "done",
          video: { url: "", respect_moderation: false },
        }),
        { status: 200 },
      );
    });
    const job = await retrieveXaiVideo(
      "req_mod",
      { XAI_API_KEY: "xai-test" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(job.status).toBe("failed");
    expect(job.error?.message).toMatch(/moderation/i);
  });
});
