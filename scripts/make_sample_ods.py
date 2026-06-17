#!/usr/bin/env python3
"""Generate sample.ods for local testing — a real OpenDocument zip (not SheetJS output).
Includes a duplicate email + honeycomb.io rows (one a subdomain) to exercise the
load-time filters. Run: python3 scripts/make_sample_ods.py"""
import os
import zipfile
from xml.sax.saxutils import escape

ROWS = [
    ["Timestamp", "Email", "First Name", "Last Name", "Company"],
    ["2026-06-17 09:01", "jordan@example.com", "Jordan", "Diaz", "Pinball Wizards LLC"],
    ["2026-06-17 09:02", "mia@example.com", "Mia", "Chen", "Tilt Labs"],
    ["2026-06-17 09:03", "sam@example.com", "Sam", "Okafor", "Flipper, Co"],
    ["2026-06-17 09:04", "ava@example.com", "Ava", "Romano", "Bumper Studios"],
    ["2026-06-17 09:05", "leo@example.com", "Leo", "Park", "Plunger Inc"],
    ["2026-06-17 09:06", "noah@example.com", "Noah", "Khan", "Multiball Media"],
    ["2026-06-17 09:07", "zoe@example.com", "Zoe", "Adams", "Drop Target Design"],
    ["2026-06-17 09:08", "eli@example.com", "Eli", "Brooks", "Replay Games"],
    ["2026-06-17 09:09", "rick@honeycomb.io", "Rick", "Abruzzo", "Honeycomb"],
    ["2026-06-17 09:10", "qa@eng.honeycomb.io", "QA", "Bot", "Honeycomb"],
    ["2026-06-17 09:11", "mia@example.com", "Mia", "Chen", "Tilt Labs"],
    ["", "", "", "", ""],
]


def cell(v):
    if v == "" or v is None:
        return "<table:table-cell/>"
    return ('<table:table-cell office:value-type="string"><text:p>'
            + escape(str(v)) + "</text:p></table:table-cell>")


def row(r):
    return "<table:table-row>" + "".join(cell(c) for c in r) + "</table:table-row>"


content = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<office:document-content '
    'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" '
    'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" '
    'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" '
    'office:version="1.2"><office:body><office:spreadsheet>'
    '<table:table table:name="Entrants">'
    + "".join(row(r) for r in ROWS) +
    "</table:table></office:spreadsheet></office:body></office:document-content>"
)

manifest = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<manifest:manifest '
    'xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" '
    'manifest:version="1.2">'
    '<manifest:file-entry manifest:full-path="/" '
    'manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>'
    '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>'
    "</manifest:manifest>"
)

out = os.path.join(os.path.dirname(__file__), "..", "sample.ods")
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    # mimetype must be the first entry and stored uncompressed
    z.writestr(zipfile.ZipInfo("mimetype"),
               "application/vnd.oasis.opendocument.spreadsheet",
               compress_type=zipfile.ZIP_STORED)
    z.writestr("META-INF/manifest.xml", manifest)
    z.writestr("content.xml", content)

print("wrote", os.path.abspath(out))
