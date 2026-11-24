/**
 * True when `page` is a positive integer past the last result page.
 * The original file was 12 lines and was not in the captured source.
 * Invalid `page` text is a separate URL check and is not rewritten to page 1.
 */
export function isPaginationBeyondResults(page: number, pageCount: number): boolean {
  if (!Number.isInteger(page) || page < 1) return false;
  if (!Number.isInteger(pageCount) || pageCount < 0) return false;
  return page > pageCount;
}
