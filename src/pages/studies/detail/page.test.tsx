import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const bag = vi.hoisted(() => ({
  isEditor: false,
}));

vi.mock("@/hooks/use-workspace.ts", () => ({
  useWorkspace: () => ({
    current: { _id: "ws1", name: "Acme", role: bag.isEditor ? "editor" : "member" },
    isEditor: bag.isEditor,
    isOwner: false,
  }),
}));

vi.mock("@/lib/api/complete", () => ({
  api: {
    studies: {
      get: vi.fn(async () => ({
        _id: "s1",
        title: "Secret draft",
        audience: "PMs",
        status: "draft",
        tracks: [],
      })),
      listSources: vi.fn(async () => []),
    },
  },
}));

import StudyDetailPage from "./page";

describe("StudyDetailPage", () => {
  it("blocks members from the study editor UI", () => {
    bag.isEditor = false;
    render(
      <MemoryRouter initialEntries={["/studies/s1"]}>
        <Routes>
          <Route path="/studies/:studyId" element={<StudyDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/you don't have access/i)).toBeInTheDocument();
    expect(screen.queryByText("Secret draft")).not.toBeInTheDocument();
  });
});
