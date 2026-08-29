# Third-party notices and data sources

P3R Save Lab is an unofficial fan project. Persona 3 Reload, its character and
item names, and related trademarks are property of their respective owners.

## P3R-Save-EnDecryptor

The Steam save encryption logic in `js/steam-crypto.js` was adapted from and
cross-checked against
[illusionyy/P3R-Save-EnDecryptor](https://github.com/illusionyy/P3R-Save-EnDecryptor).

MIT License

Copyright (c) 2024 illusion0001

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Layout and reference data

- Core, party, Social Link, and version-dependent save offsets were
  cross-checked against
  [Hertzeil/p3rse](https://github.com/Hertzeil/p3rse). No code from that
  project is bundled; the repository did not display a license when this
  editor was prepared.
- The playtime field and its supported limit were cross-checked against
  [RealDarkCraft/persona-3-reload-save-editor](https://github.com/RealDarkCraft/persona-3-reload-save-editor).
  No code from that project is bundled; the repository did not display a
  license when this editor was prepared.
- Inventory and Persona save layouts were cross-checked against
  [rirurin/p3rpc.nativetypes](https://github.com/rirurin/p3rpc.nativetypes),
  which is licensed under LGPL-3.0. No library code is bundled or linked; this
  project uses independently written browser code and factual field layouts.
- Event-item names, Persona IDs, English names, arcana, base levels, base
  stats, and the player-Persona skill list were generated from the Persona 3
  Reload tables published in
  [aqiu384/megaten-database](https://github.com/aqiu384/megaten-database).
  That repository did not include a license file when the data was generated.
- The main item-name list was supplied by the project owner. Its original
  upstream URL was not recorded, so no more specific attribution can be made
  without that source link.

No third-party JavaScript library or remote service is loaded by the site.
