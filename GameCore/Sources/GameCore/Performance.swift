import Foundation

/// Eine gespielte Nummer in der Vorstellung.
public struct ActResult: Equatable, Sendable {
    public var memberID: String
    /// Um wie viel sich die Stimmung durch diese Nummer verändert hat.
    public var delta: Double
    /// Stimmung nach der Nummer, von 0 bis 100.
    public var mood: Double
    /// Ist etwas schiefgegangen (Seil gerissen, Bär unruhig)?
    public var mishap: Bool
}

public struct PerformanceResult: Equatable, Sendable {
    public var acts: [ActResult]
    /// Gesamtwertung von 0 bis 100.
    public var score: Double
    public var reward: Resources
    /// Gesundheit, die das Kloster als Pflege schenkt.
    public var healing: Int

    /// Die Stimmung vor der ersten Nummer und nach jeder Nummer.
    public var curve: [Double] {
        [Performance.startMood] + acts.map(\.mood)
    }
}

/// Die Regeln der Stimmungskurve aus dem Konzept.
public enum Performance {
    public static let startMood: Double = 20

    /// Ob ein Mitglied an diesem Ort auftreten darf.
    public static func isAllowed(_ member: Member, at place: Place) -> Bool {
        member.isAlive && !place.banned.contains(member.discipline)
    }

    /// Grundstärke einer Nummer, abhängig von Können, Gesundheit, Erschöpfung und Moral.
    static func strength(of member: Member, morale: Int) -> Double {
        let base = 6 + Double(member.skill) * 4
        let condition = (Double(member.health) / 100) * (1 - Double(member.fatigue) / 200)
        let spirit = 0.75 + Double(morale) / 400
        return base * condition * spirit
    }

    /// Der Faktor aus Geschmack, Wiederholung und Spannungsaufbau.
    static func factor(for feeling: Feeling, previous: [Feeling], place: Place) -> Double {
        var f = place.likes.contains(feeling) ? 1.5 : 0.9
        let last = previous.last
        let secondLast = previous.dropLast().last
        if last == feeling {
            if secondLast == feeling {
                return -0.5 // Beim dritten Mal sinkt die Stimmung
            }
            f *= 0.5 // Beim zweiten Mal steigt sie nur wenig
        }
        if feeling == .tension && last == .heart {
            f *= 1.4 // Ruhe vor der Spannung verstärkt den Höhepunkt
        }
        return f
    }

    /// Die erwartete Kurve ohne Zufall. Sie wird beim Legen des Programms
    /// als goldener Faden angezeigt.
    public static func expectedCurve(program: [Member], place: Place, morale: Int) -> [Double] {
        var mood = startMood
        var curve = [mood]
        var feelings: [Feeling] = []
        for member in program {
            let delta = strength(of: member, morale: morale) * factor(for: member.feeling, previous: feelings, place: place)
            mood = clampMood(mood + delta)
            curve.append(mood)
            feelings.append(member.feeling)
        }
        return curve
    }

    /// Spielt die Vorstellung mit Zufall: riskante Nummern streuen stark und
    /// können misslingen, erschöpfte Künstler patzen eher.
    public static func perform(program: [Member], place: Place, morale: Int,
                               rng: inout SeededRandom) -> PerformanceResult {
        var mood = startMood
        var feelings: [Feeling] = []
        var acts: [ActResult] = []
        for member in program {
            let strength = strength(of: member, morale: morale)
            var delta = strength * factor(for: member.feeling, previous: feelings, place: place)
            var mishap = false
            let mishapChance = (member.discipline.isRisky ? 0.10 : 0.03)
                + Double(member.fatigue) / 400
                + Double(100 - member.health) / 400
            if rng.unit() < mishapChance {
                mishap = true
                delta = -strength * 0.6
            } else if member.discipline.isRisky {
                delta *= 0.5 + rng.unit() // 0,5 bis 1,5
            } else {
                delta *= 0.85 + rng.unit() * 0.3 // 0,85 bis 1,15
            }
            mood = clampMood(mood + delta)
            acts.append(ActResult(memberID: member.id, delta: delta, mood: mood, mishap: mishap))
            feelings.append(member.feeling)
        }
        let score = self.score(moods: acts.map(\.mood))
        return PerformanceResult(acts: acts, score: score,
                                 reward: reward(score: score, place: place),
                                 healing: place.kind == .monastery ? Int(score / 5) : 0)
    }

    /// Fläche unter der Kurve (Eröffnung und Finale zählen doppelt) und Endpunkt.
    public static func score(moods: [Double]) -> Double {
        guard !moods.isEmpty else { return 0 }
        var total = 0.0
        var weights = 0.0
        for (i, m) in moods.enumerated() {
            let w: Double = (i == 0 || i == moods.count - 1) ? 2 : 1
            total += m * w
            weights += w
        }
        let area = total / weights
        return (0.6 * area + 0.4 * moods.last!).rounded()
    }

    /// Was der Ort für eine Vorstellung dieser Güte zahlt.
    public static func reward(score: Double, place: Place) -> Resources {
        let s = Int(score)
        let morale = (s - 50) / 5
        switch place.kind {
        case .village:
            return Resources(food: 2 + s / 5, coins: s / 25, wood: s / 30, morale: morale)
        case .market:
            return Resources(food: s / 10, coins: 2 + s / 4, wood: 0, morale: morale)
        case .castle:
            return Resources(food: s / 12, coins: 4 + s / 3, wood: s / 25, morale: morale)
        case .monastery:
            return Resources(food: 4 + s / 8, coins: 0, wood: s / 20, morale: morale)
        }
    }

    static func clampMood(_ value: Double) -> Double {
        min(100, max(0, value))
    }
}
