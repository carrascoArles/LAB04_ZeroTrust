import { describe, expect, it } from "vitest";
import {
  checkDonationAmount,
  formatCents,
  parseSolesToCents,
  progressPercent,
} from "../src/domain/money";
import { countLabel } from "../src/domain/labels";

describe("parseSolesToCents (CA-05.1, research F7)", () => {
  it.each([
    ["19.99", 1999],
    ["19,99", 1999],
    ["19.9", 1990],
    ["20", 2000],
    [" 20.00 ", 2000],
    ["0.07", 7],
    ["1000", 100_000],
    ["4.35", 435], // 4.35 * 100 da 434.99999999999994
    ["1.15", 115], // 1.15 * 100 da 114.99999999999999
  ])("convierte %s en %i céntimos enteros", (text, cents) => {
    const result = parseSolesToCents(text);
    expect(result).toBe(cents);
    expect(Number.isInteger(result)).toBe(true);
  });

  it.each(["", "abc", "19.999", "-5", "1,000.00", "1e3", "19.", ".99", "19 99", "NaN"])(
    "rechaza el formato %j",
    (text) => {
      expect(parseSolesToCents(text)).toBeNull();
    },
  );
});

describe("checkDonationAmount: límites del contrato (100 a 100000 céntimos)", () => {
  it("acepta S/ 1.00 y S/ 1,000.00", () => {
    expect(checkDonationAmount("1")).toEqual({ ok: true, cents: 100 });
    expect(checkDonationAmount("1000")).toEqual({ ok: true, cents: 100_000 });
  });

  it.each([
    ["0.99", "El monto mínimo es S/ 1.00."],
    ["0", "El monto mínimo es S/ 1.00."],
    ["1000.01", "El monto máximo es S/ 1,000.00."],
    ["", "Escribe un monto."],
  ])("rechaza %j con un mensaje claro", (text, message) => {
    expect(checkDonationAmount(text)).toEqual({ ok: false, message });
  });
});

describe("formatCents", () => {
  it.each([
    [0, "S/ 0.00"],
    [7, "S/ 0.07"],
    [1999, "S/ 19.99"],
    [123_456, "S/ 1,234.56"],
    [500_000, "S/ 5,000.00"],
  ])("muestra %i como %s", (cents, text) => {
    expect(formatCents(cents)).toBe(text);
  });
});

describe("countLabel", () => {
  it("concuerda el sustantivo con la cantidad", () => {
    expect(countLabel(1, "evento", "eventos")).toBe("1 evento");
    expect(countLabel(0, "evento", "eventos")).toBe("0 eventos");
    expect(countLabel(51, "proyecto publicado", "proyectos publicados")).toBe(
      "51 proyectos publicados",
    );
  });
});

describe("progressPercent", () => {
  it("redondea hacia abajo y acota a 100", () => {
    expect(progressPercent(125_000, 500_000)).toBe(25);
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(900, 500)).toBe(100);
    expect(progressPercent(0, 500)).toBe(0);
  });
});
