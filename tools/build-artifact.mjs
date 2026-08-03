/* Genera la versione single-file dell'app (per l'Artifact / uso su telefono):
   inlinea data/kb.js dentro index.html e rimuove il wrapper doctype/head/body.
   Uso:  node tools/build-artifact.mjs [percorso-output]                        */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || path.join(ROOT, "dist", "fantahq-single.html");

let s = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const kb = fs.readFileSync(path.join(ROOT, "data", "kb.js"), "utf8");

s = s.replace(/^<!doctype html>\s*<html lang="it">\s*<head>\s*<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*/i, "");
s = s.replace(/<\/head>\s*<body>\s*/, "");
s = s.replace(/\s*<\/body>\s*<\/html>\s*$/, "\n");
s = s.replace('<script src="data/kb.js"></script>', "<script>\n" + kb + "</script>");

if (/<!doctype|<\/html>|<script src=/.test(s)) throw new Error("pulizia incompleta");
if (!s.includes("window.FANTAHQ_DATA")) throw new Error("kb non inlineato");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, s);
console.log("OK single-file:", s.length, "bytes ->", OUT);
