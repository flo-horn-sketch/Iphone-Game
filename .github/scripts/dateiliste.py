#!/usr/bin/env python3
"""Schreibt die Liste aller Dateien der Web-Version (für das Offline-Laden beim Start).

Aufruf: python3 dateiliste.py <ordner> <version>
Ergebnis: <ordner>/dateien.json mit Pfad, Größe und Prüfsumme jeder Datei.
Die App vergleicht beim Start diese Liste mit dem, was schon auf dem iPhone liegt,
und lädt nur Neues oder Geändertes nach.
"""
import hashlib
import json
import os
import sys

ordner, version = sys.argv[1], sys.argv[2]
# Nicht in den Offline-Speicher: was immer frisch vom Netz kommen muss, und der Service Worker selbst.
AUSSER = {"dateien.json", "version.json", "sw.js", ".nojekyll"}

dateien = []
for wurzel, _, namen in os.walk(ordner):
    for name in namen:
        voll = os.path.join(wurzel, name)
        pfad = os.path.relpath(voll, ordner).replace(os.sep, "/")
        if pfad in AUSSER or name.startswith("."):
            continue
        with open(voll, "rb") as f:
            inhalt = f.read()
        dateien.append({"pfad": pfad, "groesse": len(inhalt), "hash": hashlib.sha256(inhalt).hexdigest()[:16]})

dateien.sort(key=lambda d: d["pfad"])
with open(os.path.join(ordner, "dateien.json"), "w", encoding="utf-8") as f:
    json.dump({"version": version, "dateien": dateien}, f, indent=1)
print(f"{len(dateien)} Dateien, {sum(d['groesse'] for d in dateien) / 1e6:.1f} MB")
