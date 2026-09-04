/**
 * UTC timestamps as ISO-8601 strings.
 *
 * We keep these as strings (not Date) so the same type can cross the API,
 * worker, and web bundle without JSON serialization surprises.
 */
export type IsoDateTime = string;
