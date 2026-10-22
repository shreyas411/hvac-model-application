// ponytail: GWPs (AR4, as used by UK F-Gas rules) for common refrigerants only; unknown gas = no interval shown. Ignores the hermetically-sealed (<10 t) exemption and the leak-detection halving.
const GWP: Record<string, number> = { R410A: 2088, R32: 675, R134A: 1430, R407C: 1774, R404A: 3922, R407A: 2107, R407F: 1825, R417A: 2346, R290: 3, R600A: 3 };

export const refrigerantTonnes = (type?: string | null, kg?: number | null) => {
  const gwp = type ? GWP[type.replace(/[\s-]/g, '').toUpperCase()] : undefined;
  return gwp && kg ? (kg * gwp) / 1000 : null;
};

/** Months between F-Gas leak checks, or null when below 5 tCO2e or unknown. */
export const leakCheckMonths = (type?: string | null, kg?: number | null) => {
  const t = refrigerantTonnes(type, kg);
  return t === null || t < 5 ? null : t >= 500 ? 3 : t >= 50 ? 6 : 12;
};
