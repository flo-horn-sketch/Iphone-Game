import Foundation

/// Alle Bilder, die das Spiel kennt. Die gleiche Liste mit fertigen
/// ChatGPT-Prompts steht in GRAFIKEN.md im Hauptordner des Repos.
///
/// So tauschst du ein Bild aus: PNG (oder JPG) mit genau dem Namen aus
/// dieser Liste in den Ordner DieFahrenden/Grafiken legen, zum Beispiel
/// "karte-mittelreich.png". Fehlt ein Bild, zeigt das Spiel einen Platzhalter
/// mit Name und Größe.
struct GrafikSpec: Identifiable {
    enum Gruppe: String, CaseIterable {
        case karten = "Karten"
        case orte = "Orte und Wagen"
        case portraits = "Porträts"
        case buehne = "Bühnen"
        case publikum = "Publikum"
        case ereignisse = "Ereignistafeln"
        case symbole = "Symbole"
    }

    let name: String
    let gruppe: Gruppe
    /// Breite × Höhe in Pixeln, so wie ChatGPT sie liefert.
    let breite: Int
    let hoehe: Int
    /// Braucht einen transparenten Hintergrund.
    let transparent: Bool
    /// SF-Symbol, das bis dahin als Platzhalter dient (für kleine Bilder).
    let ersatzSymbol: String?

    var id: String { name }
    var groesse: String { "\(breite)×\(hoehe)" }
}

enum GrafikListe {
    private static func karte(_ n: String) -> GrafikSpec {
        GrafikSpec(name: n, gruppe: .karten, breite: 1536, hoehe: 1024, transparent: false, ersatzSymbol: nil)
    }
    private static func tafel(_ n: String, _ g: GrafikSpec.Gruppe) -> GrafikSpec {
        GrafikSpec(name: n, gruppe: g, breite: 1536, hoehe: 1024, transparent: false, ersatzSymbol: nil)
    }
    private static func portrait(_ n: String) -> GrafikSpec {
        GrafikSpec(name: n, gruppe: .portraits, breite: 1024, hoehe: 1024, transparent: false, ersatzSymbol: "person.crop.circle.fill")
    }
    private static func figur(_ n: String, _ g: GrafikSpec.Gruppe, _ symbol: String) -> GrafikSpec {
        GrafikSpec(name: n, gruppe: g, breite: 1024, hoehe: 1024, transparent: true, ersatzSymbol: symbol)
    }

    static let alle: [GrafikSpec] = [
        karte("karte-welt"),
        karte("karte-mittelreich"),
        karte("karte-nordmark"),
        karte("karte-lagunen"),
        karte("karte-steppe"),
        karte("karte-wueste"),

        figur("ort-dorf", .orte, "house.fill"),
        figur("ort-markt", .orte, "bag.fill"),
        figur("ort-burg", .orte, "shield.fill"),
        figur("ort-kloster", .orte, "bell.fill"),
        figur("wagen", .orte, "cart.fill"),

        portrait("portrait-berta"),
        portrait("portrait-jorin"),
        portrait("portrait-lene"),
        portrait("portrait-tamo"),
        portrait("portrait-wenzel"),
        portrait("portrait-mira"),
        portrait("portrait-kaspar"),

        tafel("buehne-dorf", .buehne),
        tafel("buehne-markt", .buehne),
        tafel("buehne-burg", .buehne),
        tafel("buehne-kloster", .buehne),

        figur("publikum-volk", .publikum, "person.fill"),
        figur("publikum-adel", .publikum, "crown.fill"),
        figur("publikum-geistlichkeit", .publikum, "book.closed.fill"),

        tafel("ereignis-woelfe", .ereignisse),
        tafel("ereignis-schlamm", .ereignisse),
        tafel("ereignis-fluechtlinge", .ereignisse),
        tafel("ereignis-fieber", .ereignisse),
        tafel("ereignis-baerenfuehrer", .ereignisse),
        tafel("ereignis-hunger", .ereignisse),

        figur("symbol-brot", .symbole, "fork.knife"),
        figur("symbol-muenze", .symbole, "centsign.circle.fill"),
        figur("symbol-holz", .symbole, "tree.fill"),
        figur("symbol-moral", .symbole, "face.smiling"),
        figur("symbol-tag", .symbole, "sun.max.fill"),
        figur("symbol-gefahr", .symbole, "exclamationmark.triangle.fill"),
        figur("symbol-wald", .symbole, "leaf.fill"),
        figur("symbol-jubel", .symbole, "hands.clap.fill"),
        figur("symbol-panne", .symbole, "bolt.trianglebadge.exclamationmark.fill"),
        figur("symbol-gaehnen", .symbole, "zzz"),
        figur("symbol-schloss", .symbole, "lock.fill"),
        figur("symbol-krank", .symbole, "allergens"),
        figur("symbol-tod", .symbole, "cross.fill"),
        figur("symbol-pflege", .symbole, "cross.case.fill"),
        figur("gefuehl-spannung", .symbole, "bolt.fill"),
        figur("gefuehl-humor", .symbole, "theatermasks.fill"),
        figur("gefuehl-staunen", .symbole, "sparkles"),
        figur("gefuehl-herz", .symbole, "heart.fill"),
        figur("disziplin-akrobatik", .symbole, "figure.gymnastics"),
        figur("disziplin-narretei", .symbole, "theatermasks"),
        figur("disziplin-tiere", .symbole, "pawprint.fill"),
        figur("disziplin-gaukelei", .symbole, "circle.grid.cross.fill"),
        figur("disziplin-musik", .symbole, "music.note"),
        figur("disziplin-feuer", .symbole, "flame.fill"),
        figur("disziplin-erzaehlung", .symbole, "book.fill"),
    ]

    private static let nachName: [String: GrafikSpec] =
        Dictionary(uniqueKeysWithValues: alle.map { ($0.name, $0) })

    static func spec(_ name: String) -> GrafikSpec? {
        nachName[name]
    }
}
