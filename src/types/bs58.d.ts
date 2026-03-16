declare module 'bs58' {
  function decode(input: string): Uint8Array
  function encode(buffer: Uint8Array): string
}
