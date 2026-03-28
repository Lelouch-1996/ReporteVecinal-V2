import { describe, expect, it } from "vitest";
import { buildCsvRows, findDuplicates, normalizeText } from "./App.jsx";

describe("Sprint 3 helpers", () => {
  it("normaliza texto con acentos y mayúsculas", () => {
    expect(normalizeText("Árbol DEL Centro")).toBe("arbol del centro");
  });

  it("detecta posibles reportes duplicados por zona y ubicación", () => {
    const reports = [
      {
        id: "1",
        type: "Bache",
        zone: "Centro",
        location: "Av. Juárez 120",
        description: "Bache grande frente a la tienda",
      },
      {
        id: "2",
        type: "Basura",
        zone: "Sur",
        location: "Calle 2",
        description: "Bolsa de basura",
      },
    ];

    const duplicates = findDuplicates(reports, {
      type: "Bache",
      zone: "Centro",
      location: "Av. Juárez 120",
      description: "Bache grande frente a la tienda de la esquina",
    });

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].id).toBe("1");
  });

  it("genera encabezados y filas válidas para CSV", () => {
    const csv = buildCsvRows([
      {
        id: "ABC",
        type: "Luminaria",
        zone: "Norte",
        location: "Calle Morelos 88",
        status: "En proceso",
        hidden: false,
        hiddenReason: "",
        createdBy: "vecino@demo.com",
        createdAt: "2026-03-28T12:00:00.000Z",
        comments: [{ hidden: false }, { hidden: true }],
      },
    ]);

    expect(csv).toContain('"Tipo"');
    expect(csv).toContain('"Luminaria"');
    expect(csv).toContain('"1"');
  });
});
