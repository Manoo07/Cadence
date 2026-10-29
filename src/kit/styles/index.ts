import type { StylePack } from "../tokens.ts";
import { paperVector } from "./paper-vector.ts";

export const STYLES: Record<string, StylePack> = {
  "paper-vector": paperVector,
};

export const getStyle = (name: string): StylePack =>
  STYLES[name] ?? paperVector;

export { paperVector };
