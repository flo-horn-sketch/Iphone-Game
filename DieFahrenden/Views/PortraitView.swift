import SwiftUI
import GameCore

/// Rundes Porträt mit farbigem Gesundheitsring, Krankheits- und Todeszeichen.
struct PortraitView: View {
    let member: Member
    var size: CGFloat = 44

    private var ringColor: Color {
        if !member.isAlive { return .gray }
        if member.health > 60 { return Color(red: 0.45, green: 0.75, blue: 0.35) }
        if member.health > 30 { return Color(red: 0.95, green: 0.75, blue: 0.25) }
        return Color(red: 0.85, green: 0.25, blue: 0.2)
    }

    var body: some View {
        ZStack {
            GameImage(name: member.portrait)
                .frame(width: size, height: size)
                .clipShape(Circle())
                .grayscale(member.isAlive ? 0 : 1)
                .opacity(member.isAlive ? 1 : 0.5)
            Circle()
                .trim(from: 0, to: CGFloat(member.isAlive ? member.health : 100) / 100)
                .stroke(ringColor, style: StrokeStyle(lineWidth: max(2, size * 0.07), lineCap: .round))
                .rotationEffect(.degrees(-90))
                .frame(width: size + size * 0.12, height: size + size * 0.12)
            if member.isSick && member.isAlive {
                GameIcon(name: "symbol-krank", size: size * 0.38, tint: .green)
                    .background(Circle().fill(Theme.dunkel))
                    .offset(x: size * 0.38, y: -size * 0.38)
            }
            if !member.isAlive {
                GameIcon(name: "symbol-tod", size: size * 0.4, tint: Theme.pergament)
            }
        }
        .frame(width: size * 1.15, height: size * 1.15)
    }
}

/// Die Truppe unten links. Ein Tippen zeigt Name und Zustand.
struct PortraitBar: View {
    @EnvironmentObject var model: GameModel
    @State private var shown: String?

    var body: some View {
        HStack(spacing: 6) {
            ForEach(model.state.troupe) { member in
                PortraitView(member: member, size: 38)
                    .onTapGesture { shown = member.id }
                    .popover(isPresented: Binding(
                        get: { shown == member.id },
                        set: { if !$0 { shown = nil } }
                    )) {
                        MemberDetail(member: member)
                            .presentationCompactAdaptation(.popover)
                    }
            }
        }
        .padding(6)
        .background(.black.opacity(0.5), in: Capsule())
    }
}

struct MemberDetail: View {
    let member: Member

    var body: some View {
        HStack(spacing: 12) {
            PortraitView(member: member, size: 56)
            VStack(alignment: .leading, spacing: 4) {
                Text(member.name).font(Theme.titel(17))
                Text(member.role).font(Theme.text(14)).foregroundStyle(.secondary)
                HStack(spacing: 8) {
                    GameIcon(name: member.discipline.iconName, size: 20)
                    GameIcon(name: member.feeling.iconName, size: 20)
                    Text(String(repeating: "★", count: member.skill))
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.gold)
                }
                if member.fatigue > 50 {
                    HStack(spacing: 4) {
                        GameIcon(name: "symbol-gaehnen", size: 16)
                        Text("\(member.fatigue)").font(Theme.text(13))
                    }
                }
            }
        }
        .padding(14)
        .foregroundStyle(Theme.pergament)
        .background(Theme.dunkel)
    }
}
