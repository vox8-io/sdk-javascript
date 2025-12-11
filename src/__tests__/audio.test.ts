import { describe, it, expect } from 'vitest';
import { floatTo16BitPCM, arrayBufferToBase64, base64ToArrayBuffer } from '../audio';

describe('floatTo16BitPCM', () => {
  it('converts silent audio correctly', () => {
    const input = new Float32Array([0, 0, 0, 0]);
    const output = floatTo16BitPCM(input);
    expect(output).toEqual(new Int16Array([0, 0, 0, 0]));
  });

  it('converts max positive value correctly', () => {
    const input = new Float32Array([1.0]);
    const output = floatTo16BitPCM(input);
    expect(output[0]).toBe(32767);
  });

  it('converts max negative value correctly', () => {
    const input = new Float32Array([-1.0]);
    const output = floatTo16BitPCM(input);
    expect(output[0]).toBe(-32768);
  });

  it('clamps values outside -1 to 1 range', () => {
    const input = new Float32Array([2.0, -2.0]);
    const output = floatTo16BitPCM(input);
    expect(output[0]).toBe(32767);
    expect(output[1]).toBe(-32768);
  });
});

describe('base64 conversion', () => {
  it('roundtrips correctly', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 255, 0, 128]);
    const base64 = arrayBufferToBase64(original.buffer);
    const result = new Uint8Array(base64ToArrayBuffer(base64));
    expect(result).toEqual(original);
  });

  it('handles empty buffer', () => {
    const original = new Uint8Array([]);
    const base64 = arrayBufferToBase64(original.buffer);
    const result = new Uint8Array(base64ToArrayBuffer(base64));
    expect(result).toEqual(original);
  });
});
