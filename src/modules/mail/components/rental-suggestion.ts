type RentalReference = { id: string; number: string };

export function suggestMailRental<T extends RentalReference>(text: string, rentals: T[]): T | null {
  const matches = rentals.filter((rental) => {
    const reference = rental.number.trim();
    if (reference.length < 3) return false;
    const escaped = reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:loca[cç][aã]o|rental)\\s*(?:n(?:[úu]mero|[º°o.]|o\\.)?\\s*)?[:#-]?\\s*${escaped}(?![\\p{L}\\p{N}])`, "iu");
    return pattern.test(text);
  });
  return matches.length === 1 ? matches[0] : null;
}
