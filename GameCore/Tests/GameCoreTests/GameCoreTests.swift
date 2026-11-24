import XCTest
@testable import GameCore

final class WorldTests: XCTestCase {
    func testBundledWorldLoadsAndIsValid() throws {
        let world = try World.bundled()
        XCTAssertEqual(world.validate(), [])
        XCTAssertFalse(world.places(in: "mittelreich").isEmpty)
        XCTAssertEqual(world.regions.filter(\.isOpen).map(\.id), ["mittelreich"])
    }

    func testEveryPlaceIsReachable() throws {
        let world = try World.bundled()
        var reached: Set<String> = [world.start.place]
        var queue = [world.start.place]
        while let next = queue.popLast() {
            for n in world.neighbours(of: next) where !reached.contains(n) {
                reached.insert(n)
                queue.append(n)
            }
        }
        XCTAssertEqual(reached, Set(world.places.map(\.id)))
    }
}

final class PerformanceTests: XCTestCase {
    let village = Place(id: "v", name: "Dorf", kind: .village, region: "r",
                        position: MapPoint(x: 0.5, y: 0.5), likes: [.humor], banned: [.fire])

    func member(_ id: String, _ feeling: Feeling, _ discipline: Discipline = .music, skill: Int = 3) -> Member {
        Member(id: id, name: id, role: "", portrait: "", discipline: discipline, feeling: feeling, skill: skill)
    }

    func testLikedFeelingRaisesMoodMore() {
        let liked = Performance.expectedCurve(program: [member("a", .humor)], place: village, morale: 60)
        let other = Performance.expectedCurve(program: [member("a", .wonder)], place: village, morale: 60)
        XCTAssertGreaterThan(liked[1], other[1])
    }

    func testThirdSameFeelingInARowLowersMood() {
        let program = [member("a", .wonder), member("b", .wonder), member("c", .wonder)]
        let curve = Performance.expectedCurve(program: program, place: village, morale: 60)
        XCTAssertGreaterThan(curve[1], curve[0])
        XCTAssertLessThan(curve[2] - curve[1], curve[1] - curve[0], "zweite gleiche Nummer steigt weniger")
        XCTAssertLessThan(curve[3], curve[2], "dritte gleiche Nummer senkt die Stimmung")
    }

    func testHeartBeforeTensionGivesBonus() {
        let calmFirst = Performance.expectedCurve(program: [member("a", .heart), member("b", .tension)], place: village, morale: 60)
        let humorFirst = Performance.expectedCurve(program: [member("a", .wonder), member("b", .tension)], place: village, morale: 60)
        XCTAssertGreaterThan(calmFirst[2] - calmFirst[1], humorFirst[2] - humorFirst[1])
    }

    func testExhaustedPerformerIsWeaker() {
        var tired = member("a", .humor)
        tired.fatigue = 100
        tired.health = 50
        let fresh = Performance.expectedCurve(program: [member("a", .humor)], place: village, morale: 60)
        let weak = Performance.expectedCurve(program: [tired], place: village, morale: 60)
        XCTAssertLessThan(weak[1], fresh[1])
    }

    func testBannedDisciplineIsNotAllowed() {
        XCTAssertFalse(Performance.isAllowed(member("t", .wonder, .fire), at: village))
        XCTAssertTrue(Performance.isAllowed(member("w", .heart, .music), at: village))
    }

    func testScoreCountsOpeningAndFinaleDouble() {
        // Ein starkes Finale wiegt mehr als eine starke Mitte.
        XCTAssertGreaterThan(Performance.score(moods: [20, 20, 80]), Performance.score(moods: [20, 80, 20]))
    }

    func testPerformanceIsDeterministicForSameSeed() {
        let program = [member("a", .humor, .acrobatics), member("b", .heart), member("c", .tension, .fire)]
        var r1 = SeededRandom(seed: 42)
        var r2 = SeededRandom(seed: 42)
        let a = Performance.perform(program: program, place: village, morale: 60, rng: &r1)
        let b = Performance.perform(program: program, place: village, morale: 60, rng: &r2)
        XCTAssertEqual(a, b)
        XCTAssertEqual(a.curve.count, 4)
    }
}

final class GameStateTests: XCTestCase {
    var world: World!

    override func setUpWithError() throws {
        world = try World.bundled()
    }

    func testTravelConsumesFoodAndWoodAndAdvancesDays() throws {
        var state = GameState(world: world, seed: 1)
        let start = state.resources
        let report = try state.travel(to: "weidenau", in: world)
        XCTAssertEqual(report.days, 2)
        XCTAssertEqual(state.day, 3)
        XCTAssertEqual(state.location, "weidenau")
        XCTAssertEqual(report.foodEaten, 2 * world.troupe.count)
        XCTAssertEqual(state.resources.food, start.food - report.foodEaten)
        XCTAssertEqual(state.resources.wood, start.wood - 2)
    }

    func testCannotTravelWithoutRoad() {
        var state = GameState(world: world, seed: 1)
        XCTAssertThrowsError(try state.travel(to: "furtheim", in: world)) { error in
            XCTAssertEqual(error as? GameError, .noRoad)
        }
    }

    func testHungerHurtsAndTriggersHungerEvent() throws {
        var state = GameState(world: world, seed: 7)
        state.resources.food = 0
        let report = try state.travel(to: "weidenau", in: world)
        XCTAssertEqual(report.hungryDays, 2)
        XCTAssertTrue(state.aliveMembers.allSatisfy { $0.health <= 70 })
        XCTAssertEqual(report.event?.id, "hunger")
    }

    func testStarvationCanKill() throws {
        var state = GameState(world: world, seed: 3)
        state.resources.food = 0
        state.troupe[0].health = 10
        let report = try state.travel(to: "weidenau", in: world)
        XCTAssertTrue(report.deaths.contains(state.troupe[0].id))
        XCTAssertFalse(state.troupe[0].isAlive)
    }

    func testRecruitOptionAddsMember() throws {
        var state = GameState(world: world, seed: 1)
        let event = try XCTUnwrap(world.event("fluechtlinge"))
        let result = try state.choose(event.options[0], of: event, in: world)
        XCTAssertEqual(result.joined, ["mira"])
        XCTAssertNotNil(state.member("mira"))
        XCTAssertEqual(result.change.food, -6)
        XCTAssertTrue(state.seenEvents.contains("fluechtlinge"))
    }

    func testLockedOptionNeedsDiscipline() throws {
        var state = GameState(world: world, seed: 1)
        let event = try XCTUnwrap(world.event("woelfe"))
        let music = event.options[2]
        XCTAssertTrue(state.isAvailable(music))
        state.troupe.removeAll { $0.discipline == .music }
        XCTAssertFalse(state.isAvailable(music))
        XCTAssertThrowsError(try state.choose(music, of: event, in: world))
    }

    func testSeenEventsDoNotRepeatButHungerDoes() throws {
        var state = GameState(world: world, seed: 1)
        state.seenEvents = ["fluechtlinge", "hunger"]
        XCTAssertFalse(state.canHappen(try XCTUnwrap(world.event("fluechtlinge"))))
        XCTAssertTrue(state.canHappen(try XCTUnwrap(world.event("hunger"))))
    }

    func testPerformancePaysAndTiresPerformers() throws {
        var state = GameState(world: world, seed: 5)
        let before = state.resources
        let result = try state.perform(program: ["jorin", "berta", "lene"], in: world)
        XCTAssertEqual(result.acts.count, 3)
        XCTAssertEqual(state.resources.food, before.food + result.reward.food)
        XCTAssertEqual(state.member("jorin")?.fatigue, 10)
        XCTAssertEqual(state.member("tamo")?.fatigue, 0)
    }

    func testMonasteryRejectsFireAct() throws {
        var state = GameState(world: world, seed: 5)
        state.location = "sankt-ilgen"
        let result = try state.perform(program: ["tamo", "berta"], in: world)
        XCTAssertEqual(result.acts.map(\.memberID), ["berta"])
    }

    func testBuyingCostsCoins() throws {
        var state = GameState(world: world, seed: 1)
        state.resources.coins = 4
        try state.buy(.food)
        XCTAssertEqual(state.resources.coins, 1)
        XCTAssertEqual(state.resources.food, world.start.resources.food + 5)
        XCTAssertFalse(state.canBuy(.food))
        XCTAssertThrowsError(try state.buy(.food))
    }

    func testStateRoundTripsThroughJSON() throws {
        var state = GameState(world: world, seed: 9)
        _ = try state.travel(to: "weidenau", in: world)
        let data = try JSONEncoder().encode(state)
        let restored = try JSONDecoder().decode(GameState.self, from: data)
        XCTAssertEqual(restored.day, state.day)
        XCTAssertEqual(restored.troupe, state.troupe)
        XCTAssertEqual(restored.resources, state.resources)
    }
}
