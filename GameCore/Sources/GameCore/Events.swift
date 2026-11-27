import Foundation

/// Wann ein Ereignis auftreten kann.
public enum EventTrigger: String, Codable, Sendable {
    /// Auf einem Waldweg.
    case forest
    /// Auf jeder Reise.
    case travel
    /// Wenn die Vorräte nach einer Reise aufgebraucht sind.
    case hunger
}

/// Was eine Entscheidung bewirkt. Alle Felder sind optional, damit die
/// Ereignisse in welt.json kurz bleiben.
public struct EventEffect: Codable, Equatable, Sendable {
    public var food: Int?
    public var coins: Int?
    public var wood: Int?
    public var morale: Int?
    /// Gesundheit aller Mitglieder ändern.
    public var healthAll: Int?
    /// Gesundheit eines zufälligen Mitglieds ändern.
    public var healthRandom: Int?
    /// Ein neues Mitglied stößt dazu (ID aus "recruits" in welt.json).
    public var recruit: String?
    /// Dieses Mitglied verlässt die Truppe.
    public var removeMember: String?
    /// Dieses Mitglied wird krank.
    public var makeSick: String?

    public init(food: Int? = nil, coins: Int? = nil, wood: Int? = nil, morale: Int? = nil,
                healthAll: Int? = nil, healthRandom: Int? = nil, recruit: String? = nil,
                removeMember: String? = nil, makeSick: String? = nil) {
        self.food = food
        self.coins = coins
        self.wood = wood
        self.morale = morale
        self.healthAll = healthAll
        self.healthRandom = healthRandom
        self.recruit = recruit
        self.removeMember = removeMember
        self.makeSick = makeSick
    }

    /// Nur die Vorratsänderungen, für die Anzeige als Symbole.
    public var resources: Resources {
        Resources(food: food ?? 0, coins: coins ?? 0, wood: wood ?? 0, morale: morale ?? 0)
    }
}

public struct EventOption: Codable, Equatable, Sendable {
    public var label: String
    public var effect: EventEffect
    /// Was danach passiert, in einem Satz.
    public var outcome: String
    /// Die Option ist nur wählbar, wenn ein lebendes Mitglied diese Disziplin hat.
    public var requires: Discipline?
}

public struct GameEvent: Codable, Identifiable, Equatable, Sendable {
    public let id: String
    public var title: String
    /// Höchstens ein Satz.
    public var text: String
    /// Bildname der Ereignistafel, zum Beispiel "ereignis-woelfe".
    public var image: String
    public var trigger: EventTrigger
    /// Nur auslösen, wenn dieses Mitglied (noch) in der Truppe ist.
    public var needsMember: String?
    /// Darf mehrmals vorkommen (zum Beispiel Hunger).
    public var repeatable: Bool?
    public var options: [EventOption]
}
