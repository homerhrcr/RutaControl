import { expect, test } from "bun:test";
import { leerCoordenadas, pegarCoordenadas } from "./coordenadas";

test("conserva coordenadas decimales y acepta cero", () => {
  expect(leerCoordenadas("9.928100", "-84.090700")).toEqual({ lat: 9.9281, lng: -84.0907 });
  expect(leerCoordenadas("0", "0")).toEqual({ lat: 0, lng: 0 });
});
test("una ubicación vacía es null y no permite coordenadas incompletas o fuera de rango", () => {
  expect(leerCoordenadas("", "")).toBeNull();
  for (const [lat, lng] of [["91", "0"], ["0", "181"], ["", "0"], ["abc", "0"]]) expect(() => leerCoordenadas(lat, lng)).toThrow();
});
test("pega una pareja de coordenadas", () => {
  expect(pegarCoordenadas("9.928100, -84.090700")).toEqual({ lat: 9.9281, lng: -84.0907 });
  expect(() => pegarCoordenadas("9, 84, 20")).toThrow();
});