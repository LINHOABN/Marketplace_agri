/** Retire les accents pour comparaison locale (recherche, filtres). */
export function foldAccents(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Compare deux chaînes en ignorant la casse et les accents. */
export function equalsFolded(a: string, b: string): boolean {
  return foldAccents(a).toLowerCase() === foldAccents(b).toLowerCase();
}
