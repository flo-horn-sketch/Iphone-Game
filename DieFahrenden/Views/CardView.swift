import SwiftUI
import GameCore

/// Die Tafeln nach einer Reise: Reisebericht, Ereignis und dessen Folgen.
struct CardView: View {
    let card: GameModel.Card
    @EnvironmentObject var model: GameModel

    var body: some View {
        switch card {
        case .travelSummary(let report):
            TravelSummaryCard(report: report)
        case .event(let event):
            EventCard(event: event, resolution: nil)
        case .eventOutcome(let event, let resolution):
            EventCard(event: event, resolution: resolution)
        }
    }
}

struct TravelSummaryCard: View {
    let report: TravelReport
    @EnvironmentObject var model: GameModel

    var body: some View {
        VStack(spacing: 16) {
            HStack(spacing: 18) {
                HStack(spacing: 4) {
                    GameIcon(name: "symbol-tag", size: 24)
                    Text("\(report.days)").font(Theme.titel(20))
                }
                ChangeBadge(icon: "symbol-brot", amount: -report.foodEaten)
                ChangeBadge(icon: "symbol-holz", amount: -report.woodBurned)
            }
            if report.hungryDays > 0 || report.coldDays > 0 {
                HStack(spacing: 6) {
                    ForEach(0..<report.hungryDays, id: \.self) { _ in
                        GameIcon(name: "symbol-brot", size: 26, tint: .red)
                            .overlay(Rectangle().fill(.red).frame(height: 3).rotationEffect(.degrees(-45)))
                    }
                    ForEach(0..<report.coldDays, id: \.self) { _ in
                        GameIcon(name: "symbol-holz", size: 26, tint: .cyan)
                            .overlay(Rectangle().fill(.cyan).frame(height: 3).rotationEffect(.degrees(-45)))
                    }
                }
            }
            if !report.fellSick.isEmpty || !report.deaths.isEmpty {
                HStack(spacing: 12) {
                    ForEach(report.fellSick.filter { !report.deaths.contains($0) } + report.deaths, id: \.self) { id in
                        if let member = model.state.member(id) {
                            VStack(spacing: 2) {
                                PortraitView(member: member, size: 52)
                                Text(member.name).font(Theme.titel(12))
                            }
                        }
                    }
                }
            }
            MainButton(title: "Weiter") { model.dismissSummary() }
        }
        .padding(24)
        .frame(minWidth: 320)
        .foregroundStyle(Theme.pergament)
        .background(Theme.dunkel.opacity(0.95), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(Theme.gold.opacity(0.7), lineWidth: 1.5))
    }
}

/// Eine gemalte Ereignistafel mit Entscheidungen. Jede Option zeigt ihre
/// Folgen als Symbole, gesperrte Optionen zeigen, was fehlt.
struct EventCard: View {
    let event: GameEvent
    let resolution: EventResolution?
    @EnvironmentObject var model: GameModel

    var body: some View {
        HStack(spacing: 0) {
            GameImage(name: event.image, contentMode: .fill)
                .frame(width: 330, height: 300)
                .clipped()

            VStack(alignment: .leading, spacing: 10) {
                Text(event.title)
                    .font(Theme.titel(22))
                    .foregroundStyle(Theme.hellgold)
                if let resolution {
                    Text(resolution.outcome)
                        .font(Theme.text(16))
                    OutcomeBadges(resolution: resolution)
                    Spacer(minLength: 0)
                    MainButton(title: "Weiter") { model.dismissOutcome() }
                } else {
                    Text(event.text)
                        .font(Theme.text(16))
                    Spacer(minLength: 0)
                    ForEach(Array(event.options.enumerated()), id: \.offset) { _, option in
                        OptionButton(option: option, available: model.state.isAvailable(option)) {
                            model.choose(option, of: event)
                        }
                    }
                }
            }
            .padding(18)
            .frame(width: 360, height: 300, alignment: .topLeading)
        }
        .foregroundStyle(Theme.pergament)
        .background(Theme.dunkel.opacity(0.96))
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(Theme.gold.opacity(0.7), lineWidth: 1.5))
        .shadow(color: .black.opacity(0.6), radius: 16)
    }
}

struct OptionButton: View {
    let option: EventOption
    let available: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    if !available {
                        GameIcon(name: "symbol-schloss", size: 14, tint: Theme.pergament)
                    }
                    if let needed = option.requires {
                        GameIcon(name: needed.iconName, size: 16)
                    }
                    Text(option.label)
                        .font(Theme.titel(15))
                }
                EffectBadges(effect: option.effect)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(Theme.weinrot.opacity(available ? 0.85 : 0.35), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.gold.opacity(available ? 0.7 : 0.25)))
        }
        .buttonStyle(.plain)
        .disabled(!available)
        .opacity(available ? 1 : 0.55)
    }
}

/// Die vorhergesagten Folgen einer Option.
struct EffectBadges: View {
    let effect: EventEffect
    @EnvironmentObject var model: GameModel

    var body: some View {
        HStack(spacing: 8) {
            ResourceChanges(change: effect.resources)
            if let h = effect.healthAll {
                HStack(spacing: 1) {
                    Image(systemName: "person.3.fill").font(.system(size: 11))
                    ChangeBadge(icon: "symbol-pflege", amount: h)
                }
            }
            if let h = effect.healthRandom {
                HStack(spacing: 1) {
                    Image(systemName: "person.fill.questionmark").font(.system(size: 11))
                    ChangeBadge(icon: "symbol-pflege", amount: h)
                }
            }
            if let id = effect.recruit, let m = model.world.recruits.first(where: { $0.id == id }) {
                MiniMember(member: m, sign: "+", color: .green)
            }
            if let id = effect.removeMember, let m = model.state.member(id) {
                MiniMember(member: m, sign: "−", color: .red)
            }
            if let id = effect.makeSick, let m = model.state.member(id) {
                HStack(spacing: 1) {
                    PortraitView(member: m, size: 18)
                    GameIcon(name: "symbol-krank", size: 14, tint: .green)
                }
            }
        }
        .font(Theme.text(12))
    }
}

struct MiniMember: View {
    let member: Member
    let sign: String
    let color: Color

    var body: some View {
        HStack(spacing: 1) {
            Text(sign).font(Theme.titel(14)).foregroundStyle(color)
            PortraitView(member: member, size: 18)
        }
    }
}

/// Was nach der Entscheidung wirklich passiert ist.
struct OutcomeBadges: View {
    let resolution: EventResolution
    @EnvironmentObject var model: GameModel

    var body: some View {
        HStack(spacing: 10) {
            ResourceChanges(change: resolution.change)
            ForEach(resolution.joined, id: \.self) { id in
                if let m = model.state.member(id) { MiniMember(member: m, sign: "+", color: .green) }
            }
            ForEach(resolution.left, id: \.self) { id in
                if let m = model.world.troupe.first(where: { $0.id == id }) { MiniMember(member: m, sign: "−", color: .red) }
            }
            ForEach(resolution.deaths, id: \.self) { id in
                if let m = model.state.member(id) { PortraitView(member: m, size: 30) }
            }
        }
    }
}
