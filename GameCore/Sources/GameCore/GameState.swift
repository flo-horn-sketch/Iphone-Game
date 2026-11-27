import Foundation

/// Was auf einer Reise passiert ist.
public struct TravelReport: Equatable, Sendable {
    public var from: String
    public var to: String
    public var days: Int
    public var foodEaten: Int
    public var woodBurned: Int
    /// Tage, an denen das Essen nicht reichte.
    public var hungryDays: Int
    /// Nächte ohne Feuerholz.
    public var coldDays: Int
    /// Wer unterwegs krank geworden ist.
    public var fellSick: [String]
    /// Wer unterwegs gestorben ist.
    public var deaths: [String]
    /// Das Ereignis, das jetzt entschieden werden muss.
    public var event: GameEvent?
}

public struct EventResolution: Equatable, Sendable {
    public var outcome: String
    public var change: Resources
    public var joined: [String]
    public var left: [String]
    public var deaths: [String]
}

public enum GameError: Error, Equatable {
    case noRoad
    case optionLocked
    case unknownPlace
    case notEnoughCoins
}

/// Was man nach der Vorstellung auf dem Markt kaufen kann.
public enum Goods: String, CaseIterable, Sendable {
    case food
    case wood

    /// Preis in Münzen und erhaltene Menge.
    public var deal: (price: Int, amount: Int) {
        switch self {
        case .food: return (3, 5)
        case .wood: return (2, 3)
        }
    }
}

/// Der ganze veränderliche Spielstand. Er lässt sich als JSON speichern.
public struct GameState: Codable, Sendable {
    public var day: Int
    public var location: String
    public var resources: Resources
    public var troupe: [Member]
    public var seenEvents: Set<String>
    public var visits: [String: Int]
    public var rng: SeededRandom

    /// Was eine Person pro Reisetag isst.
    public static let foodPerMemberPerDay = 1
    /// Holz für das Lagerfeuer pro Nacht.
    public static let woodPerNight = 1

    public init(world: World, seed: UInt64) {
        day = 1
        location = world.start.place
        resources = world.start.resources
        troupe = world.troupe
        seenEvents = []
        visits = [world.start.place: 1]
        rng = SeededRandom(seed: seed)
    }

    public var aliveMembers: [Member] {
        troupe.filter(\.isAlive)
    }

    public func member(_ id: String) -> Member? {
        troupe.first { $0.id == id }
    }

    public var isGameOver: Bool {
        aliveMembers.isEmpty || resources.morale <= 0
    }

    /// Wochentag-unabhängige Jahreszeit: 30 Tage je Jahreszeit.
    public var season: String {
        ["Frühling", "Sommer", "Herbst", "Winter"][((day - 1) / 30) % 4]
    }

    /// Ob dieses Ereignis jetzt passieren kann.
    func canHappen(_ event: GameEvent) -> Bool {
        guard event.repeatable == true || !seenEvents.contains(event.id) else { return false }
        if let m = event.needsMember {
            return member(m)?.isAlive == true
        }
        return true
    }

    // MARK: Reise

    public mutating func travel(to destination: String, in world: World) throws -> TravelReport {
        guard world.place(destination) != nil else { throw GameError.unknownPlace }
        guard let road = world.road(between: location, and: destination) else { throw GameError.noRoad }

        var report = TravelReport(from: location, to: destination, days: road.days,
                                  foodEaten: 0, woodBurned: 0, hungryDays: 0, coldDays: 0,
                                  fellSick: [], deaths: [], event: nil)
        let aliveBefore = Set(aliveMembers.map(\.id))

        for _ in 0..<road.days {
            day += 1
            let mouths = aliveMembers.count * Self.foodPerMemberPerDay
            if resources.food >= mouths {
                resources.food -= mouths
                report.foodEaten += mouths
            } else {
                report.foodEaten += resources.food
                resources.food = 0
                report.hungryDays += 1
                resources.morale -= 5
                changeHealthOfAll(by: -15)
            }
            if resources.wood >= Self.woodPerNight {
                resources.wood -= Self.woodPerNight
                report.woodBurned += Self.woodPerNight
            } else {
                report.coldDays += 1
                resources.morale -= 3
                changeHealthOfAll(by: -5)
            }
            for i in troupe.indices where troupe[i].isAlive {
                troupe[i].fatigue = min(100, troupe[i].fatigue + 8)
                if troupe[i].isSick { troupe[i].changeHealth(by: -10) }
            }
            // Das Fieber steckt manchmal andere an.
            if troupe.contains(where: { $0.isAlive && $0.isSick }), rng.unit() < 0.15,
               let i = randomAliveIndex(where: { !$0.isSick }) {
                troupe[i].isSick = true
                report.fellSick.append(troupe[i].id)
            }
            resources.clamp()
        }

        report.deaths = troupe.filter { aliveBefore.contains($0.id) && !$0.isAlive }.map(\.id)
        location = destination
        visits[destination, default: 0] += 1
        report.event = pickEvent(for: road, in: world)
        return report
    }

    mutating func pickEvent(for road: Road, in world: World) -> GameEvent? {
        let open = world.events.filter(canHappen)
        if resources.food == 0, let e = open.first(where: { $0.trigger == .hunger }) {
            return e
        }
        if road.kind == .forest, rng.unit() < 0.6 {
            let forest = open.filter { $0.trigger == .forest }
            if !forest.isEmpty { return forest[Int(rng.next() % UInt64(forest.count))] }
        }
        if rng.unit() < 0.45 {
            let travel = open.filter { $0.trigger == .travel }
            if !travel.isEmpty { return travel[Int(rng.next() % UInt64(travel.count))] }
        }
        return nil
    }

    // MARK: Ereignisse

    public func isAvailable(_ option: EventOption) -> Bool {
        guard let needed = option.requires else { return true }
        return aliveMembers.contains { $0.discipline == needed }
    }

    public mutating func choose(_ option: EventOption, of event: GameEvent, in world: World) throws -> EventResolution {
        guard isAvailable(option) else { throw GameError.optionLocked }
        let effect = option.effect
        let aliveBefore = Set(aliveMembers.map(\.id))
        var joined: [String] = []
        var left: [String] = []

        let before = resources
        resources = resources + effect.resources
        resources.clamp()

        if let amount = effect.healthAll { changeHealthOfAll(by: amount) }
        if let amount = effect.healthRandom, let i = randomAliveIndex() {
            troupe[i].changeHealth(by: amount)
        }
        if let id = effect.makeSick, let i = troupe.firstIndex(where: { $0.id == id && $0.isAlive }) {
            troupe[i].isSick = true
            troupe[i].changeHealth(by: -10)
        }
        if let id = effect.removeMember, let i = troupe.firstIndex(where: { $0.id == id }) {
            troupe.remove(at: i)
            left.append(id)
        }
        if let id = effect.recruit, member(id) == nil, let newcomer = world.recruits.first(where: { $0.id == id }) {
            troupe.append(newcomer)
            joined.append(id)
        }
        seenEvents.insert(event.id)

        let deaths = troupe.filter { aliveBefore.contains($0.id) && !$0.isAlive }.map(\.id)
        let change = Resources(food: resources.food - before.food, coins: resources.coins - before.coins,
                               wood: resources.wood - before.wood, morale: resources.morale - before.morale)
        return EventResolution(outcome: option.outcome, change: change, joined: joined, left: left, deaths: deaths)
    }

    // MARK: Vorstellung

    /// Spielt das Programm am aktuellen Ort und verbucht Lohn und Erschöpfung.
    public mutating func perform(program memberIDs: [String], in world: World) throws -> PerformanceResult {
        guard let place = world.place(location) else { throw GameError.unknownPlace }
        let program = memberIDs.compactMap { id in troupe.first { $0.id == id } }
            .filter { Performance.isAllowed($0, at: place) }
        let result = Performance.perform(program: program, place: place, morale: resources.morale, rng: &rng)

        resources = resources + result.reward
        resources.clamp()
        let performers = Set(program.map(\.id))
        for i in troupe.indices where troupe[i].isAlive {
            if performers.contains(troupe[i].id) {
                troupe[i].fatigue = min(100, troupe[i].fatigue + 10)
            } else {
                troupe[i].fatigue = max(0, troupe[i].fatigue - 20)
            }
            if result.healing > 0 {
                troupe[i].changeHealth(by: result.healing)
                if troupe[i].health >= 80 { troupe[i].isSick = false }
            }
        }
        return result
    }

    // MARK: Handel

    public func canBuy(_ goods: Goods) -> Bool {
        resources.coins >= goods.deal.price
    }

    public mutating func buy(_ goods: Goods) throws {
        let deal = goods.deal
        guard canBuy(goods) else { throw GameError.notEnoughCoins }
        resources.coins -= deal.price
        switch goods {
        case .food: resources.food += deal.amount
        case .wood: resources.wood += deal.amount
        }
    }

    // MARK: Hilfen

    mutating func changeHealthOfAll(by amount: Int) {
        for i in troupe.indices { troupe[i].changeHealth(by: amount) }
    }

    mutating func randomAliveIndex(where condition: (Member) -> Bool = { _ in true }) -> Int? {
        let candidates = troupe.indices.filter { troupe[$0].isAlive && condition(troupe[$0]) }
        guard !candidates.isEmpty else { return nil }
        return candidates[Int(rng.next() % UInt64(candidates.count))]
    }
}
