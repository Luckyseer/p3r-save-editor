# P3R Save Lab

## [Open P3R Save Lab](https://luckyseer.github.io/p3r-save-editor/)

P3R Save Lab is an unofficial Persona 3 Reload save editor that runs in a web
browser. It supports Steam saves and supported decrypted saves. The selected
file stays in the browser and the original file is never changed.

> [!WARNING]
> Save editing can cause crashes, story problems, lost progress, or an
> unloadable save. Close the game and keep an untouched backup before using an
> edited file. A valid file can still contain a combination the game does not
> expect.

## Find your Steam save

1. Close Persona 3 Reload.
2. Press `Win + R`.
3. Paste `%APPDATA%\SEGA\P3R\Steam` and press Enter.
4. Open the folder named with your Steam account number.
5. Copy the `SaveDataNNN.sav` file you want to edit to a safe working folder.

Each numbered file corresponds to a game save slot. Do not edit your only copy.
The location is also documented by
[SteamDB](https://steamdb.info/app/2161700/ufs/).

## Use the editor

1. Open the hosted P3R Save Lab page.
2. Leave **Input format** on **Auto-detect** unless you already know the file is
   decrypted.
3. Drop your copied `.sav` file onto the page, or click the file area to choose
   it.
4. Read the warning and review the Overview screen to confirm the expected save
   was loaded.
5. Make changes in Inventory, Party, Personas, or Social. Every change appears
   in the Session changes list.
6. Select **Validate & download** when finished.
7. Keep the original backup. Rename the downloaded `_edited` file to the exact
   original filename only when you are ready to test it in game.

The editor enforces known ranges, but it cannot know whether every possible
change makes sense for the current date or story progress. Make small changes
and test them before editing more.

## Available editing

- Inventory quantities, with item search and category filters
- Protagonist first and last name
- Yen, play time, and difficulty
- Current combat formation, including post-departure Shinjiro selection
- Party HP, SP, level, experience, and Persona skills
- The protagonist's 12 carried Persona slots
- Persona level, experience, stats, and skills
- Velvet Room Compendium registrations, with search and locked/unlocked filters
- Social stat point totals, with in-game level references
- Social Link ranks

Persona skills are selected from a searchable known-skill list. Party skill
editing includes Fuuka's navigator abilities, but unusual combinations may not
work correctly and can be replaced by later level-ups. Adding a Persona to the
protagonist's stock also registers its base form in the Compendium when needed,
preventing crashes caused by carried Personas with missing registrations.

Current-party editing always keeps the protagonist as leader, allows at most
three unique combat allies, and excludes Fuuka because she is the navigator.
Selecting Shinjiro shows a warning because transitions or scripted scenes may
remove him or behave incorrectly after his story departure.

## Supported files

- Steam `SaveDataNNN.sav`: read and write
- Supported decrypted P3R save: read and write
- Xbox/Game Pass saves: not supported
- PlayStation saves: not supported

## Privacy

The editor is a static site with no account, analytics, upload service, or
runtime network dependency. Your selected save stays in the current browser
tab. Reference lists for items, Personas, and skills are included with the
site.

## GitHub Pages

This repository includes a GitHub Actions workflow for Pages. To publish a
fork, select **GitHub Actions** under **Settings > Pages**, then push to `main`
or run the workflow manually. The deployment contains only the static editor,
its reference data, and license.

Technical and data sources are credited on the editor page. P3R Save Lab is
licensed under the [MIT License](LICENSE).
