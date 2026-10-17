import { describe, expect, test } from "bun:test";
import { provincias, cantonesDe, distritosDe, cambiarProvincia, cambiarCanton, normalizarDireccion, errorDireccion } from "./division-territorial";

describe("dirección en cascada", () => {
  test("cada provincia muestra solo sus cantones", () => {
    expect(cantonesDe("San José").map((c) => c.nombre)).toContain("Desamparados");
    expect(cantonesDe("San José").map((c) => c.nombre)).not.toContain("Guácimo");
    expect(cantonesDe("Limón").map((c) => c.nombre)).toContain("Guácimo");
  });
  test("cada cantón muestra solo sus distritos", () => {
    expect(distritosDe("San José", "Escazú")).toEqual(["Escazú", "San Antonio", "San Rafael"]);
    expect(distritosDe("Limón", "Escazú")).toEqual([]);
    expect(distritosDe("Limón", "Guácimo")).toContain("Duacarí");
  });
  test("cambiar provincia limpia cantón y distrito", () => {
    expect(cambiarProvincia("Cartago")).toEqual({ provincia: "Cartago", canton: "", distrito: "" });
  });
  test("cambiar cantón limpia distrito y conserva provincia", () => {
    expect(cambiarCanton({ provincia: "San José", canton: "Escazú", distrito: "San Rafael" }, "Desamparados"))
      .toEqual({ provincia: "San José", canton: "Desamparados", distrito: "" });
  });
  test("impide guardar combinaciones ajenas al padre", () => {
    expect(errorDireccion({ provincia: "San José", canton: "Guácimo", distrito: "" })).not.toBeNull();
    expect(errorDireccion({ provincia: "San José", canton: "Escazú", distrito: "Carmen" })).not.toBeNull();
    expect(errorDireccion({ provincia: "San José", canton: "Escazú", distrito: "San Rafael" })).toBeNull();
    expect(errorDireccion({ provincia: "", canton: "", distrito: "" })).toBeNull();
  });
  test("reconoce nombres existentes sin tildes y conserva desconocidos para revisión", () => {
    expect(normalizarDireccion({ provincia: "SAN JOSE", canton: "escazu", distrito: "san rafael" }))
      .toEqual({ provincia: "San José", canton: "Escazú", distrito: "San Rafael" });
    expect(normalizarDireccion({ provincia: "Otra", canton: "Anterior", distrito: "Original" }).distrito).toBe("Original");
  });
  test("catálogo completo incluye los cantones nuevos", () => {
    expect(provincias).toHaveLength(7);
    expect(provincias.flatMap((p) => p.cantones)).toHaveLength(84);
    expect(provincias.flatMap((p) => p.cantones.flatMap((c) => c.distritos))).toHaveLength(492);
    expect(distritosDe("Puntarenas", "Monteverde")).toEqual(["Monteverde"]);
    expect(distritosDe("Puntarenas", "Puerto Jiménez")).toEqual(["Puerto Jiménez"]);
  });
});