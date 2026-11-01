# Trainingsplan (PWA)

Reines HTML/CSS/JavaScript, kein Backend, kein Build-Schritt.

## Dateien in diesem Paket
- Die App selbst (Ordner `js/`, `css/`, `index.html` …) – **ohne** deine Trainingsdaten, damit sie gefahrlos
  öffentlich gehostet werden kann.
- `standalone.html` (separat geliefert): alles in einer Datei, mit eingebetteten Daten. Nur zum privaten Ausprobieren
  per Doppelklick am Rechner. Nicht veröffentlichen!

## Ohne Hosting: nur `standalone.html` auf dem Handy
Datei herunterladen (nicht in der OneDrive-Vorschau öffnen) und mit Chrome öffnen. Aktualisieren der Daten:
Startseite → **„Daten aktualisieren“** → eine oder mehrere CSV-Dateien wählen (der Dateiauswahldialog kann direkt in
OneDrive blättern). Die App erkennt selbst, welche Datei Plan, Ist-Daten, Basisdaten, WK-Kalender oder Vorjahre ist.
Einschränkungen: Das Nachladen passiert nicht automatisch beim Öffnen, und ein Startbildschirm-Icon für eine lokale
Datei ist unter Android nicht zuverlässig (die Verknüpfung zeigt oft auf eine abgelaufene Adresse).
Automatisches Nachladen aus OneDrive und ein echtes App-Icon gibt es nur mit der gehosteten Variante unten.

## 1. App auf dem Handy installieren
Eine PWA braucht HTTPS. Die Dateien müssen dafür auf einen Webserver. Einfachste Wege (jeweils kostenlos):

**Netlify (per Drag & Drop)**
1. ZIP entpacken.
2. https://app.netlify.com/drop öffnen, den entpackten Ordner ins Fenster ziehen.
3. Du erhältst eine Adresse wie `https://irgendwas.netlify.app/`. Mit einem (kostenlosen) Netlify-Konto bleibt die Seite dauerhaft bestehen.

**GitHub Pages**
1. Konto bei github.com, neues Repository anlegen, den Inhalt des entpackten Ordners hochladen („Add file → Upload files“).
2. Repository → Settings → Pages → Branch `main`, Ordner `/ (root)` → Speichern. Adresse: `https://<name>.github.io/<repo>/`.

**Auf dem Handy**
Adresse in Chrome (Android) öffnen → Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.
(iPhone: Safari → Teilen → „Zum Home-Bildschirm“.)

Nach Änderungen an Dateien `VERSION` in `sw.js` erhöhen und neu hochladen, sonst bleibt die alte Version im Cache.

## 2. OneDrive verbinden (privates Microsoft-Konto)
Die App liest beide CSV-Dateien direkt aus deinem OneDrive. Beim Start wird immer neu geladen; kehrst du später
in die App zurück, wird erneut geladen, wenn der letzte Abgleich mehr als 5 Minuten her ist (`SYNC` in `js/core/config.js`).
Die zuletzt geladenen Dateien bleiben offline verfügbar.

**Einmalig: App bei Microsoft registrieren (kostenlos, ca. 5 Minuten)**
1. https://entra.microsoft.com öffnen und mit dem privaten Microsoft-Konto anmelden, dem das OneDrive gehört.
2. Identität → Anwendungen → App-Registrierungen → **Neue Registrierung**.
3. Name: z. B. „Trainingsplan“. Unterstützte Kontotypen: **„Nur persönliche Microsoft-Konten“** (bzw. „Konten in allen Organisationsverzeichnissen und persönliche Microsoft-Konten“).
4. Weiterleitungs-URI: Plattform **„Single-Page-Anwendung (SPA)“**, Wert = die Adresse deiner gehosteten App **mit** abschließendem `/`
   (steht auch in der App unter Einstellungen → OneDrive → „Weiterleitungs-URI“). Registrieren.
5. Auf der Übersichtsseite die **Anwendungs-(Client-)ID** kopieren.
6. Optional: API-Berechtigungen → Berechtigung hinzufügen → Microsoft Graph → Delegierte Berechtigungen → `Files.Read`.

**In der App (Einstellungen → OneDrive)**
1. Client-ID einfügen.
2. Pfade der Dateien eintragen, ab dem OneDrive-Stamm, z. B. `Training/Plan.csv`
   (Groß-/Kleinschreibung beachten). Leere Pfade werden nicht verwendet.
3. „Bei OneDrive anmelden“, bei Microsoft zustimmen. Fertig.

Tipp: Client-ID und Pfade können auch vor dem Hochladen in `js/core/config.js` (`ONEDRIVE_DEFAULTS`) eingetragen werden –
dann entfällt das Tippen auf dem Handy.

**Gut zu wissen**
- Die Anmeldung von Web-Apps läuft bei Microsoft nach 24 Stunden ab. Dann erscheint auf der Startseite ein Hinweis mit
  Button „Bei OneDrive anmelden“ (ein Tipp, meist ohne Passwort). Bis dahin zeigt die App die zuletzt geladenen Daten.
- Die App darf nur lesen (`Files.Read`) und nichts ändern.
- „Abmelden“ in den Einstellungen löscht auch die lokale Kopie der OneDrive-Dateien.
- Funktioniert nur in der gehosteten App (https), nicht in `standalone.html`.

## Daten (fünf CSV-Dateien)
| Datei | Inhalt | Pflicht |
|---|---|---|
| Plan | Trainingsplan mit Wochenstart (Spalte „Erster Tag der Woche“) | ja |
| Ist-Daten | absolvierte Einheiten | nein (für Vergleich/Auswertung) |
| Basisdaten | Saisonbeginn, Saisonende, Race A1, Race A2 | nein |
| WK-Kalender | geplante Wettkämpfe | nein |
| Vorjahre | Einheiten früherer Jahre, bezogen auf das jeweilige Race A1 | nein |

- Spalten werden über die Überschriften erkannt (Reihenfolge egal). Zeilen ohne sinnvolle Daten werden ignoriert.
- **Basisdaten und WK-Kalender können in einer Datei stehen** (mit oder ohne Kopfzeile):

      Typ;Datum;Name
      Saisonbeginn;01.11.2025;
      Saisonende;31.10.2026;
      Race A1;05.07.2026;Beispiel-Triathlon
      Race A2;04.10.2026;Beispiel-Marathon
      WK;15.03.2026;Beispiellauf

  Dann trägst du nur bei „Basisdaten“ einen Pfad ein und lässt „WK-Kalender“ leer. Die bisherigen zwei Dateien
  funktionieren unverändert weiter. Wettkämpfe am Tag von Race A1/A2 werden nicht doppelt geführt.
- Vorjahre: je Jahr eine Zeile „Start“ und eine Zeile „RACE A1“; Zeilen mit Jahr 0 oder ungültigem Datum werden ignoriert.
- Quellenreihenfolge je Datei: OneDrive-Kopie → importierte CSV → mitgelieferte CSV (`data/*.csv`, optional).

## Ansichten
- **Aktuelle Woche** / **Plan/Ist-Vergleich**: Termine der Woche erscheinen oben (Race A1/A2 golden), in der Wochenauswahl markiert.
- **Wettkämpfe**: Zähler bis Race A1/A2, nächster Wettkampf, Saisonfortschritt, Zeitleiste, alle Termine.
- **Auswertung**: Plan-Erfüllung der Saison (je Sportart, je Woche), aktueller Trainingsblock mit Prognose, Überblick aller Blöcke.
- **Vorjahre**: Vergleich mit ausgewählten Jahren, ausgerichtet am Renntag (Stand zum gleichen Abstand zum Rennen,
  kumulierter Verlauf, Wochenumfang, Blockvergleich, Jahresumfang, Kilometer).

### Plan/Ist-Zuordnung
Eine Ist-Einheit gehört zu einer Planeinheit, wenn Woche (über „Trainingsphase III“), Sportart, Reg/Key und A/B/C
übereinstimmen. Erfüllung = Ist-Minuten / Plan-Minuten: grün über 90 %, gelb ab 50 %, rot darunter
(`THRESHOLDS` in `js/core/config.js`). Planeinheiten, deren Standard-Tag noch nicht vorbei ist, gelten als „offen“.
Ist-Einheiten ohne passende Planeinheit erscheinen als „ungeplant“.

## Anpassen
- Farben je Trainingsziel, Sportarten, Phasen, Ampel-Grenzen, Sync-Takt: `js/core/config.js`
- Neue Kachel: Eintrag in `js/tiles/registry.js`
- Neue Ansicht (z. B. Diagramm): Modul in `js/views/` + Route in `js/views/routes.js`
- Standalone-Datei neu erzeugen (CSV-Dateien in `data/` nötig): `python3 tools/build_standalone.py`
