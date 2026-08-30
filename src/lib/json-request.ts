const HTTP_BRIDGE_PADDING = "\r\n\r\n";

/**
 * Keep four legal JSON-whitespace bytes at the end of every browser request.
 *
 * The deployed HTTP bridge has been observed inserting CRLFCRLF before the
 * body without increasing Content-Length. The server then reads those four
 * bytes and truncates the final four bytes of the payload. Padding the end
 * keeps the JSON document complete on that path, while remaining valid JSON
 * on ordinary browser connections.
 */
export function serializeJsonRequestBody(payload: unknown) {
  return `${JSON.stringify(payload)}${HTTP_BRIDGE_PADDING}`;
}
