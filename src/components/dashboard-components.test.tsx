import React, { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { Header } from "./Header";
import { UploadPanel } from "./UploadPanel";
import { BlTable } from "./BlTable";
import { DetailDialog } from "./DetailDialog";
import { parseBlInput } from "../lib/bl-validation";
import type { BlBatch, BlItem } from "../lib/types";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(ui: React.ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(ui);
  });
  return container;
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

const batch: BlBatch = {
  id: "batch-1",
  nombreLote: "Lote prueba",
  estado: "validado",
  totalItems: 1,
  totalExitosos: 0,
  totalSinResultado: 0,
  totalFallidos: 0,
  totalReintentos: 0,
  createdAt: "2026-06-12T12:00:00.000Z",
  items: []
};

const item: BlItem = {
  id: "item-1",
  loteId: "batch-1",
  posicionArchivo: 1,
  identificadorOriginal: "MEDUWU951960",
  identificadorNormalizado: "MEDUWU951960",
  estado: "exitoso",
  intentoActual: 1,
  maxIntentos: 10,
  updatedAt: "2026-06-12T12:00:00.000Z",
  resultado: {
    nroBl: "MEDUWU951960",
    nroManifesto: "271842",
    nave: "MSC TIANPING",
    puertoEmbarque: "Ningbo",
    puertoDesembarque: "San Antonio",
    totalPeso: 18274.3,
    fuente: "Aduanas Chile",
    consultedAt: "2026-06-12T12:00:00.000Z"
  }
};

describe("dashboard components", () => {
  it("renders header navigation and exposes active view", () => {
    const setView = vi.fn();
    const view = render(
      <Header
        view="dashboard"
        setView={setView}
        latestBatch={batch}
        processing={false}
        canExport
        onExport={vi.fn()}
        onProcess={vi.fn()}
        onCancel={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(view.querySelector("h1")?.textContent).toBe("KPO BL Tracker");
    expect(view.querySelector("nav[aria-label='Vistas principales']")).toBeTruthy();
    expect(view.querySelector("button[aria-current='page']")?.textContent).toBe("Dashboard");
  });

  it("renders upload preview counts", () => {
    const preview = parseBlInput("MEDUWU951960\nMEDUWU951960\n***");
    const view = render(
      <UploadPanel
        raw="MEDUWU951960"
        preview={preview}
        batchName="Lote prueba"
        setBatchName={vi.fn()}
        onRaw={vi.fn()}
        onFile={vi.fn()}
        onCreate={vi.fn()}
      />
    );

    expect(view.textContent).toContain("1");
    expect(view.textContent).toContain("validos");
    expect(view.textContent).toContain("duplicados");
    expect(view.textContent).toContain("invalidos");
  });

  it("renders empty table state and table rows", () => {
    const empty = render(<BlTable rows={[]} select={vi.fn()} retry={vi.fn()} />);
    expect(empty.querySelector("[role='status']")?.textContent).toContain("No hay BL");

    act(() => {
      root?.render(<BlTable rows={[item]} select={vi.fn()} retry={vi.fn()} />);
    });
    expect(container?.textContent).toContain("MEDUWU951960");
    expect(container?.textContent).toContain("MSC TIANPING");
  });

  it("renders detail dialog and closes with Escape", () => {
    const close = vi.fn();
    const view = render(<DetailDialog item={item} close={close} />);

    expect(view.querySelector("[role='dialog']")?.getAttribute("aria-modal")).toBe("true");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(close).toHaveBeenCalledTimes(1);
  });
});
