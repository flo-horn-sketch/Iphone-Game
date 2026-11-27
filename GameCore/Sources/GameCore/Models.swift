import Foundation

/// Das Gefühl, das eine Nummer beim Publikum auslöst.
public enum Feeling: String, Codable, CaseIterable, Sendable {
    case tension   // Spannung
    case humor     // Humor
    case wonder    // Staunen
    case heart     // Herz

    public var displayName: String {
        switch self {
        case .tension: return "Spannung"
        case .humor: return "Humor"
        case .wonder: return "Staunen"
        case .heart: return "Herz"
        }
    }
}

/// Die Disziplin einer Nummer.
public enum Discipline: String, Codable, CaseIterable, Sendable {
    case acrobatics  // Akrobatik
    case foolery     // Narretei
    case animals     // Tiere
    case juggling    // Gaukelei
    case music       // Musik
    case fire        // Feuer
    case story       // Erzählung

    public var displayName: String {
        switch self {
        case .acrobatics: return "Akrobatik"
        case .foolery: return "Narretei"
        case .animals: return "Tiere"
        case .juggling: return "Gaukelei"
        case .music: return "Musik"
        case .fire: return "Feuer"
        case .story: return "Erzählung"
        }
    }

    /// Riskante Nummern schlagen stärker nach oben oder unten aus.
    public var isRisky: Bool {
        switch self {
        case .acrobatics, .fire, .animals: return true
        default: return false
        }
    }
}

/// Die Art eines Ortes bestimmt Bühne, Publikum und Lohn.
public enum PlaceKind: String, Codable, CaseIterable, Sendable {
    case village    // Dorf
    case market     // Markt
    case castle     // Burg
    case monastery  // Kloster

    public var displayName: String {
        switch self {
        case .village: return "Dorf"
        case .market: return "Markt"
        case .castle: return "Burg"
        case .monastery: return "Kloster"
        }
    }

    /// Anzahl der Bühnenbretter, also wie viele Nummern gespielt werden.
    public var stageBoards: Int {
        switch self {
        case .village: return 3
        case .market: return 5
        case .castle: return 4
        case .monastery: return 3
        }
    }
}

public enum RoadKind: String, Codable, Sendable {
    case road    // Handelsstraße: sicher
    case forest  // Waldweg: kürzer, aber gefährlich
}

/// Die Vorräte der Truppe.
public struct Resources: Codable, Equatable, Sendable {
    public var food: Int
    public var coins: Int
    public var wood: Int
    /// Moral von 0 bis 100.
    public var morale: Int

    public init(food: Int = 0, coins: Int = 0, wood: Int = 0, morale: Int = 0) {
        self.food = food
        self.coins = coins
        self.wood = wood
        self.morale = morale
    }

    public static let zero = Resources()

    public static func + (lhs: Resources, rhs: Resources) -> Resources {
        Resources(food: lhs.food + rhs.food,
                  coins: lhs.coins + rhs.coins,
                  wood: lhs.wood + rhs.wood,
                  morale: lhs.morale + rhs.morale)
    }

    /// Hält alle Werte in ihren erlaubten Grenzen.
    public mutating func clamp() {
        food = max(0, food)
        coins = max(0, coins)
        wood = max(0, wood)
        morale = min(100, max(0, morale))
    }
}

/// Ein Mitglied der Truppe. Jedes Mitglied bringt genau eine Nummer mit.
public struct Member: Codable, Identifiable, Equatable, Sendable {
    public let id: String
    public var name: String
    /// Rolle in einem Wort, zum Beispiel "Seiltänzerin".
    public var role: String
    /// Name des Porträtbildes, zum Beispiel "portrait-lene".
    public var portrait: String
    public var discipline: Discipline
    public var feeling: Feeling
    /// Können von 1 bis 5.
    public var skill: Int
    /// Gesundheit von 0 bis 100. Bei 0 stirbt das Mitglied.
    public var health: Int
    /// Erschöpfung von 0 bis 100.
    public var fatigue: Int
    public var isAlive: Bool
    public var isSick: Bool

    public init(id: String, name: String, role: String, portrait: String,
                discipline: Discipline, feeling: Feeling, skill: Int,
                health: Int = 100, fatigue: Int = 0, isAlive: Bool = true, isSick: Bool = false) {
        self.id = id
        self.name = name
        self.role = role
        self.portrait = portrait
        self.discipline = discipline
        self.feeling = feeling
        self.skill = skill
        self.health = health
        self.fatigue = fatigue
        self.isAlive = isAlive
        self.isSick = isSick
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, role, portrait, discipline, feeling, skill, health, fatigue, isAlive, isSick
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        role = try c.decode(String.self, forKey: .role)
        portrait = try c.decode(String.self, forKey: .portrait)
        discipline = try c.decode(Discipline.self, forKey: .discipline)
        feeling = try c.decode(Feeling.self, forKey: .feeling)
        skill = try c.decode(Int.self, forKey: .skill)
        health = try c.decodeIfPresent(Int.self, forKey: .health) ?? 100
        fatigue = try c.decodeIfPresent(Int.self, forKey: .fatigue) ?? 0
        isAlive = try c.decodeIfPresent(Bool.self, forKey: .isAlive) ?? true
        isSick = try c.decodeIfPresent(Bool.self, forKey: .isSick) ?? false
    }

    /// Ändert die Gesundheit und lässt das Mitglied bei 0 sterben.
    public mutating func changeHealth(by amount: Int) {
        guard isAlive else { return }
        health = min(100, max(0, health + amount))
        if health == 0 { isAlive = false }
    }
}

/// Ein Punkt auf einer Karte, als Anteil von Breite und Höhe des Kartenbildes
/// (0 = links/oben, 1 = rechts/unten). So passt die Position zu jedem Bild,
/// egal in welcher Auflösung es erzeugt wurde.
public struct MapPoint: Codable, Equatable, Sendable {
    public var x: Double
    public var y: Double

    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }
}

public struct Region: Codable, Identifiable, Equatable, Sendable {
    public let id: String
    public var name: String
    /// Bildname der Regionskarte, zum Beispiel "karte-mittelreich".
    public var mapImage: String
    /// Wo die Region auf der Weltkarte liegt.
    public var worldPosition: MapPoint
    /// Im ersten Build ist nur das Mittelreich offen.
    public var isOpen: Bool
}

public struct Place: Codable, Identifiable, Equatable, Sendable {
    public let id: String
    public var name: String
    public var kind: PlaceKind
    public var region: String
    /// Position auf der Regionskarte.
    public var position: MapPoint
    /// Was das Publikum hier besonders mag.
    public var likes: [Feeling]
    /// Disziplinen, die hier verboten sind (im Kloster zum Beispiel Feuer).
    public var banned: [Discipline]
}

public struct Road: Codable, Equatable, Sendable {
    public var from: String
    public var to: String
    public var days: Int
    public var kind: RoadKind

    public func connects(_ a: String, _ b: String) -> Bool {
        (from == a && to == b) || (from == b && to == a)
    }

    public func other(than placeID: String) -> String? {
        if from == placeID { return to }
        if to == placeID { return from }
        return nil
    }
}
