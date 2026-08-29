import { GVAS_MAGIC, STEAM_KEY, STEAM_MAGIC } from "./constants.js";
import { startsWithBytes } from "./binary.js";

function permuteByte(value) {
  return ((value >> 4) & 0x03) | ((value & 0x03) << 4) | (value & 0xcc);
}

export function decryptSteam(data) {
  const output = new Uint8Array(data.length);
  for (let index = 0; index < data.length; index += 1) {
    output[index] = permuteByte(data[index] ^ STEAM_KEY[index % STEAM_KEY.length]);
  }
  return output;
}

export function encryptSteam(data) {
  const output = new Uint8Array(data.length);
  for (let index = 0; index < data.length; index += 1) {
    output[index] = permuteByte(data[index]) ^ STEAM_KEY[index % STEAM_KEY.length];
  }
  return output;
}

export function decodeSave(data, requestedFormat = "auto") {
  const isGvas = startsWithBytes(data, GVAS_MAGIC);
  const isSteam = startsWithBytes(data, STEAM_MAGIC);

  if (requestedFormat === "steam" && !isSteam) {
    throw new Error("This file does not have the P3R Steam save header.");
  }
  if (requestedFormat === "gvas" && !isGvas) {
    throw new Error("This file is not a supported decrypted P3R save.");
  }
  if (!isGvas && !isSteam) {
    throw new Error(
      "Unrecognized file. Select a P3R Steam save or a supported decrypted save.",
    );
  }

  const decrypted = isSteam ? decryptSteam(data) : data.slice();
  if (!startsWithBytes(decrypted, GVAS_MAGIC)) {
    throw new Error("The Steam save could not be decoded.");
  }
  return { decrypted, format: isSteam ? "steam" : "gvas" };
}

export function encodeSave(decrypted, format) {
  return format === "steam" ? encryptSteam(decrypted) : decrypted.slice();
}
