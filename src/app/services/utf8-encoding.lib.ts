// Author: Preston Lee

const UTF8_DECODER_STRICT = new TextDecoder('utf-8', { fatal: true });
const UTF8_ENCODER = new TextEncoder();

export function encodeUtf8Base64(text: string): string {
  const bytes = UTF8_ENCODER.encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeUtf8Base64(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return UTF8_DECODER_STRICT.decode(bytes);
}
