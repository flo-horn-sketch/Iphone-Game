import SwiftUI
import UIKit
import GameCore

/// Farben und Schriften aus der Konzeptgrafik.
enum Theme {
    static let pergament = Color(red: 0.945, green: 0.894, blue: 0.784)   // #F1E4C8
    static let weinrot = Color(red: 0.478, green: 0.180, blue: 0.133)     // #7A2E22
    static let gold = Color(red: 0.788, green: 0.588, blue: 0.227)        // #C9963A
    static let hellgold = Color(red: 0.953, green: 0.824, blue: 0.478)    // #F3D27A
    static let nachtblau = Color(red: 0.184, green: 0.310, blue: 0.478)   // #2F4F7A
    static let dunkel = Color(red: 0.102, green: 0.071, blue: 0.051)      // #1A120D
    static let tinte = Color(red: 0.227, green: 0.141, blue: 0.090)       // #3A2417

    static func titel(_ size: CGFloat) -> Font { .system(size: size, weight: .bold, design: .serif) }
    static func text(_ size: CGFloat) -> Font { .system(size: size, weight: .regular, design: .serif) }
}

/// Lädt Bilder aus dem Ordner Grafiken (PNG, JPG oder WebP) und merkt sie sich.
/// Wird nur vom Hauptthread aus benutzt.
enum ImageStore {
    private static var cache: [String: UIImage] = [:]
    private static var missing: Set<String> = []

    static func image(_ name: String) -> UIImage? {
        if let cached = cache[name] { return cached }
        if missing.contains(name) { return nil }
        for ext in ["png", "jpg", "jpeg", "webp"] {
            if let url = Bundle.main.url(forResource: name, withExtension: ext),
               let image = UIImage(contentsOfFile: url.path) {
                cache[name] = image
                return image
            }
        }
        if let image = UIImage(named: name) {
            cache[name] = image
            return image
        }
        missing.insert(name)
        return nil
    }

    /// Seitenverhältnis Breite/Höhe, notfalls aus der Grafikliste.
    static func aspectRatio(_ name: String) -> CGFloat {
        if let image = image(name), image.size.height > 0 {
            return image.size.width / image.size.height
        }
        if let spec = GrafikListe.spec(name) {
            return CGFloat(spec.breite) / CGFloat(spec.hoehe)
        }
        return 1.5
    }
}

/// Ein großes Bild (Karte, Bühne, Ereignistafel, Porträt).
/// Fehlt es, erscheint ein Platzhalter mit Dateiname und Größe.
struct GameImage: View {
    let name: String
    var contentMode: ContentMode = .fill

    var body: some View {
        if let image = ImageStore.image(name) {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: contentMode)
        } else {
            Platzhalter(name: name)
        }
    }
}

/// Ein kleines Bild (Symbol, Ortszeichen, Publikum). Fehlt es,
/// springt ein passendes SF-Symbol ein.
struct GameIcon: View {
    let name: String
    var size: CGFloat = 22
    var tint: Color = Theme.hellgold

    var body: some View {
        Group {
            if let image = ImageStore.image(name) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
            } else {
                Image(systemName: GrafikListe.spec(name)?.ersatzSymbol ?? "questionmark.square.dashed")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(tint)
                    .padding(size * 0.08)
            }
        }
        .frame(width: size, height: size)
        .accessibilityLabel(name)
    }
}

struct Platzhalter: View {
    let name: String

    var body: some View {
        GeometryReader { geo in
            ZStack {
                LinearGradient(colors: [Theme.pergament, Theme.pergament.opacity(0.75)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                RoundedRectangle(cornerRadius: 6)
                    .strokeBorder(Theme.tinte.opacity(0.5), style: StrokeStyle(lineWidth: 2, dash: [8, 6]))
                    .padding(4)
                if geo.size.width > 70 {
                    VStack(spacing: 4) {
                        Image(systemName: "photo.artframe")
                            .font(.system(size: min(40, geo.size.height * 0.2)))
                        Text(name + ".png")
                            .font(Theme.titel(min(16, geo.size.width / 12)))
                        if let spec = GrafikListe.spec(name) {
                            Text(spec.groesse + (spec.transparent ? " · transparent" : ""))
                                .font(Theme.text(min(13, geo.size.width / 14)))
                        }
                    }
                    .foregroundStyle(Theme.tinte.opacity(0.7))
                    .multilineTextAlignment(.center)
                    .padding(8)
                }
            }
        }
    }
}

// MARK: Bildnamen für die Spieldaten

extension Feeling {
    var iconName: String {
        switch self {
        case .tension: return "gefuehl-spannung"
        case .humor: return "gefuehl-humor"
        case .wonder: return "gefuehl-staunen"
        case .heart: return "gefuehl-herz"
        }
    }
}

extension Discipline {
    var iconName: String {
        switch self {
        case .acrobatics: return "disziplin-akrobatik"
        case .foolery: return "disziplin-narretei"
        case .animals: return "disziplin-tiere"
        case .juggling: return "disziplin-gaukelei"
        case .music: return "disziplin-musik"
        case .fire: return "disziplin-feuer"
        case .story: return "disziplin-erzaehlung"
        }
    }
}

extension PlaceKind {
    var iconName: String {
        switch self {
        case .village: return "ort-dorf"
        case .market: return "ort-markt"
        case .castle: return "ort-burg"
        case .monastery: return "ort-kloster"
        }
    }

    var stageImage: String {
        switch self {
        case .village: return "buehne-dorf"
        case .market: return "buehne-markt"
        case .castle: return "buehne-burg"
        case .monastery: return "buehne-kloster"
        }
    }

    /// Wer im Publikum sitzt, für die kleinen Figuren vor der Bühne.
    var audience: [String] {
        switch self {
        case .village: return Array(repeating: "publikum-volk", count: 9)
        case .market: return ["publikum-volk", "publikum-volk", "publikum-adel", "publikum-volk", "publikum-geistlichkeit",
                              "publikum-volk", "publikum-volk", "publikum-adel", "publikum-volk", "publikum-volk"]
        case .castle: return ["publikum-adel", "publikum-adel", "publikum-adel", "publikum-geistlichkeit", "publikum-adel", "publikum-adel"]
        case .monastery: return Array(repeating: "publikum-geistlichkeit", count: 6) + ["publikum-volk", "publikum-volk"]
        }
    }
}
