import SwiftUI
import GameCore

/// Verbindet die Spiellogik (GameCore) mit der Oberfläche.
@MainActor
final class GameModel: ObservableObject {
    enum Screen: Equatable {
        case world
        case region(String)
        case performance
        case gameOver
    }

    /// Eine Reise, die gerade auf der Karte gezeigt wird.
    struct Journey: Equatable {
        var from: String
        var to: String
        var report: TravelReport
    }

    /// Was nach einer Reise der Reihe nach gezeigt wird.
    enum Card: Equatable {
        case travelSummary(TravelReport)
        case event(GameEvent)
        case eventOutcome(GameEvent, EventResolution)
    }

    let world: World
    @Published private(set) var state: GameState { didSet { save() } }
    @Published var screen: Screen
    @Published var selectedPlace: String? = nil
    @Published private(set) var journey: Journey? = nil
    @Published private(set) var card: Card? = nil
    @Published private(set) var lastPerformance: PerformanceResult? = nil

    private static let saveKey = "spielstand-v1"

    init() {
        let world: World
        do {
            world = try World.bundled()
        } catch {
            fatalError("welt.json konnte nicht geladen werden: \(error)")
        }
        self.world = world
        var state = GameState(world: world, seed: UInt64.random(in: 1...UInt64.max))
        if let saved = Self.loadSaved(), world.place(saved.location) != nil {
            state = saved
        }
        self.state = state
        self.screen = .region(world.place(state.location)?.region ?? "mittelreich")
    }

    var currentPlace: Place? { world.place(state.location) }

    var currentRegion: String { currentPlace?.region ?? "mittelreich" }

    // MARK: Karte

    func openRegion(_ id: String) {
        guard world.region(id)?.isOpen == true else { return }
        selectedPlace = nil
        screen = .region(id)
    }

    func openWorld() {
        selectedPlace = nil
        screen = .world
    }

    func road(to placeID: String) -> Road? {
        world.road(between: state.location, and: placeID)
    }

    /// Bricht zum gewählten Ort auf. Die Logik rechnet die Reise sofort aus,
    /// die Karte zeigt danach den fahrenden Wagen.
    func departTo(_ placeID: String) {
        guard journey == nil, card == nil else { return }
        let from = state.location
        var next = state
        guard let report = try? next.travel(to: placeID, in: world) else { return }
        state = next
        selectedPlace = nil
        journey = Journey(from: from, to: placeID, report: report)
    }

    /// Wird von der Karte aufgerufen, wenn der Wagen angekommen ist.
    func journeyFinished() {
        guard let journey else { return }
        self.journey = nil
        let r = journey.report
        if r.hungryDays > 0 || r.coldDays > 0 || !r.deaths.isEmpty || !r.fellSick.isEmpty {
            card = .travelSummary(r)
        } else if let event = r.event {
            card = .event(event)
        } else {
            arrive()
        }
    }

    // MARK: Karten nach der Reise

    func dismissSummary() {
        guard case .travelSummary(let r) = card else { return }
        if let event = r.event {
            card = .event(event)
        } else {
            card = nil
            arrive()
        }
    }

    func choose(_ option: EventOption, of event: GameEvent) {
        var next = state
        guard let resolution = try? next.choose(option, of: event, in: world) else { return }
        state = next
        card = .eventOutcome(event, resolution)
    }

    func dismissOutcome() {
        card = nil
        arrive()
    }

    private func arrive() {
        if state.isGameOver {
            screen = .gameOver
        } else {
            lastPerformance = nil
            screen = .performance
        }
    }

    // MARK: Vorstellung

    func perform(program: [String]) -> PerformanceResult? {
        var next = state
        guard let result = try? next.perform(program: program, in: world) else { return nil }
        state = next
        lastPerformance = result
        return result
    }

    func buy(_ goods: Goods) {
        var next = state
        guard (try? next.buy(goods)) != nil else { return }
        state = next
    }

    func leavePerformance() {
        lastPerformance = nil
        screen = state.isGameOver ? .gameOver : .region(currentRegion)
    }

    func restart() {
        UserDefaults.standard.removeObject(forKey: Self.saveKey)
        state = GameState(world: world, seed: UInt64.random(in: 1...UInt64.max))
        journey = nil
        card = nil
        lastPerformance = nil
        selectedPlace = nil
        screen = .region(currentRegion)
    }

    // MARK: Speichern

    private func save() {
        if let data = try? JSONEncoder().encode(state) {
            UserDefaults.standard.set(data, forKey: Self.saveKey)
        }
    }

    private static func loadSaved() -> GameState? {
        guard let data = UserDefaults.standard.data(forKey: saveKey) else { return nil }
        return try? JSONDecoder().decode(GameState.self, from: data)
    }
}
