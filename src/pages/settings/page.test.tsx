import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-workspace.ts", () => ({
  useWorkspace: () => ({
    current: { _id: "ws1", name: "Acme", role: "owner" },
    isEditor: true,
    isOwner: true,
    refresh: async () => undefined,
  }),
}));

vi.mock("@/hooks/use-native-viewer.ts", () => ({
  useNativeViewer: () => ({
    isAdmin: false,
    nativeViewerMode: false,
    nativeAdminAccess: false,
    loading: false,
    profile: null,
  }),
}));

vi.mock("@/lib/api/complete", () => ({
  api: {
    workspaces: {
      listInvites: vi.fn(async () => [
        {
          _id: "inv-1",
          token: "abc123",
          role: "member",
          expiresAt: Date.now() + 86400000,
          maxUses: 10,
          uses: 2,
          _creationTime: Date.now(),
        },
        {
          _id: "inv-bad",
          token: "badtok",
          role: "member",
          expiresAt: undefined,
          maxUses: null,
          uses: 0,
          _creationTime: Date.now(),
        },
      ]),
      listMembers: vi.fn(async () => []),
      revokeInvite: vi.fn(async () => undefined),
      rename: vi.fn(async () => undefined),
      getJoinCode: vi.fn(async () => "7K3M9PQ2"),
      regenerateJoinCode: vi.fn(async () => "ABCD2345"),
      emailJoinCode: vi.fn(async () => undefined),
    },
    billing: {
      actions: {
        createInvite: vi.fn(async () => ({ token: "new" })),
      },
    },
  },
}));

vi.mock("./_components/email-updates.tsx", () => ({
  default: () => null,
}));

vi.mock("./_components/delete-account.tsx", () => ({
  default: () => null,
}));

import SettingsPage from "./page";

describe("SettingsPage invites", () => {
  it("renders mapped invite rows without throwing on invalid expiry", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <SettingsPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue(/\/invite\/abc123/)).toBeInTheDocument();
    });
    expect(screen.getByText(/expires soon/i)).toBeInTheDocument();
    expect(screen.getByText(/2 of 10 joined/)).toBeInTheDocument();
  });
});
