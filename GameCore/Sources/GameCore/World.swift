import Foundation

/// Alle festen Spieldaten: Regionen, Orte, Wege, Truppe und Ereignisse.
/// Sie stehen in Resources/welt.json und lassen sich dort ohne Code ändern.
public struct World: Codable, Sendable {
    public struct Start: Codable, Sendable {
        public var place: String
        public var resources: Resources
    }

    public var start: Start
    public var regions: [Region]
    public var places: [Place]
    public var roads: [Road]
    public var troupe: [Member]
    /// Figuren, die über Ereignisse dazustoßen können.
    public var recruits: [Member]
    public var events: [GameEvent]

    public static func load(from data: Data) throws -> World {
        try JSONDecoder().decode(World.self, from: data)
    }

    /// Die mitgelieferte Welt aus welt.json.
    public static func bundled() throws -> World {
        guard let url = Bundle.module.url(forResource: "welt", withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile)
        }
        return try load(from: Data(contentsOf: url))
    }

    public func place(_ id: String) -> Place? {
        places.first { $0.id == id }
    }

    public func region(_ id: String) -> Region? {
        regions.first { $0.id == id }
    }

    public func places(in regionID: String) -> [Place] {
        places.filter { $0.region == regionID }
    }

    public func road(between a: String, and b: String) -> Road? {
        roads.first { $0.connects(a, b) }
    }

    public func neighbours(of placeID: String) -> [String] {
        roads.compactMap { $0.other(than: placeID) }
    }

    public func event(_ id: String) -> GameEvent? {
        events.first { $0.id == id }
    }

    /// Prüft die Daten auf Tippfehler, zum Beispiel einen Weg zu einem Ort,
    /// den es nicht gibt. Liefert eine Liste lesbarer Probleme.
    public func validate() -> [String] {
        var problems: [String] = []
        let placeIDs = Set(places.map(\.id))
        let regionIDs = Set(regions.map(\.id))
        let memberIDs = Set((troupe + recruits).map(\.id))
        if !placeIDs.contains(start.place) { problems.append("Startort \(start.place) fehlt") }
        for p in places {
            if !regionIDs.contains(p.region) { problems.append("Ort \(p.id): Region \(p.region) fehlt") }
            if !(0...1).contains(p.position.x) || !(0...1).contains(p.position.y) {
                problems.append("Ort \(p.id): Position muss zwischen 0 und 1 liegen")
            }
        }
        for r in roads {
            if !placeIDs.contains(r.from) { problems.append("Weg: Ort \(r.from) fehlt") }
            if !placeIDs.contains(r.to) { problems.append("Weg: Ort \(r.to) fehlt") }
            if r.days < 1 { problems.append("Weg \(r.from)–\(r.to): mindestens 1 Tag") }
        }
        for e in events {
            if e.options.isEmpty { problems.append("Ereignis \(e.id) hat keine Optionen") }
            if let m = e.needsMember, !memberIDs.contains(m) { problems.append("Ereignis \(e.id): Mitglied \(m) fehlt") }
            for o in e.options {
                for m in [o.effect.recruit, o.effect.removeMember, o.effect.makeSick].compactMap({ $0 })
                where !memberIDs.contains(m) {
                    problems.append("Ereignis \(e.id): Mitglied \(m) fehlt")
                }
            }
        }
        return problems
    }
}
