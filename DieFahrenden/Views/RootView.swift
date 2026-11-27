import SwiftUI
import GameCore

struct RootView: View {
    @EnvironmentObject var model: GameModel

    var body: some View {
        ZStack {
            Theme.dunkel.ignoresSafeArea()

            switch model.screen {
            case .world:
                WorldMapView()
                    .transition(.opacity)
            case .region(let id):
                RegionMapView(regionID: id)
                    .id(id)
                    .transition(.opacity)
            case .performance:
                PerformanceView()
                    .transition(.move(edge: .bottom))
            case .gameOver:
                GameOverView()
                    .transition(.opacity)
            }

            if let card = model.card {
                Color.black.opacity(0.55).ignoresSafeArea()
                CardView(card: card)
                    .transition(.scale(scale: 0.9).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.35), value: model.screen)
        .animation(.easeInOut(duration: 0.25), value: model.card)
    }
}

/// Kopfzeile mit Vorräten, Tag und Jahreszeit. Nur Symbole und Zahlen.
struct ResourceBar: View {
    @EnvironmentObject var model: GameModel

    var body: some View {
        let r = model.state.resources
        HStack(spacing: 14) {
            ResourceItem(icon: "symbol-brot", value: r.food, warn: r.food < model.state.aliveMembers.count * 2)
            ResourceItem(icon: "symbol-muenze", value: r.coins)
            ResourceItem(icon: "symbol-holz", value: r.wood, warn: r.wood < 2)
            ResourceItem(icon: "symbol-moral", value: r.morale, warn: r.morale < 25)
            Divider().frame(height: 18).overlay(Theme.gold.opacity(0.5))
            HStack(spacing: 4) {
                GameIcon(name: "symbol-tag", size: 18)
                Text("\(model.state.day)")
                    .font(Theme.titel(15))
                Text(model.state.season)
                    .font(Theme.text(13))
                    .foregroundStyle(Theme.pergament.opacity(0.7))
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 6)
        .background(.black.opacity(0.55), in: Capsule())
        .overlay(Capsule().strokeBorder(Theme.gold.opacity(0.5), lineWidth: 1))
        .foregroundStyle(Theme.pergament)
    }
}

struct ResourceItem: View {
    let icon: String
    let value: Int
    var warn: Bool = false

    var body: some View {
        HStack(spacing: 4) {
            GameIcon(name: icon, size: 20)
            Text("\(value)")
                .font(Theme.titel(15))
                .monospacedDigit()
                .foregroundStyle(warn ? Color.red.opacity(0.9) : Theme.pergament)
        }
    }
}

/// Eine Änderung als Symbol mit Vorzeichen, zum Beispiel Holz −3.
struct ChangeBadge: View {
    let icon: String
    let amount: Int

    var body: some View {
        HStack(spacing: 2) {
            GameIcon(name: icon, size: 18)
            Text(amount > 0 ? "+\(amount)" : "\(amount)")
                .font(Theme.titel(14))
                .foregroundStyle(amount >= 0 ? Color.green.opacity(0.9) : Color.red.opacity(0.9))
        }
    }
}

struct ResourceChanges: View {
    let change: Resources

    var body: some View {
        HStack(spacing: 10) {
            if change.food != 0 { ChangeBadge(icon: "symbol-brot", amount: change.food) }
            if change.coins != 0 { ChangeBadge(icon: "symbol-muenze", amount: change.coins) }
            if change.wood != 0 { ChangeBadge(icon: "symbol-holz", amount: change.wood) }
            if change.morale != 0 { ChangeBadge(icon: "symbol-moral", amount: change.morale) }
        }
    }
}

/// Großer goldener Knopf. Pro Bildschirm gibt es höchstens einen davon.
struct MainButton: View {
    let title: String
    var enabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(Theme.titel(17))
                .foregroundStyle(Theme.dunkel)
                .padding(.horizontal, 22)
                .padding(.vertical, 10)
                .background(
                    LinearGradient(colors: [Theme.gold, Theme.hellgold], startPoint: .leading, endPoint: .trailing),
                    in: Capsule()
                )
                .shadow(color: .black.opacity(0.4), radius: 4, y: 2)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.4)
    }
}

struct GameOverView: View {
    @EnvironmentObject var model: GameModel

    var body: some View {
        VStack(spacing: 18) {
            Text("Die Reise endet hier")
                .font(Theme.titel(30))
                .foregroundStyle(Theme.hellgold)
            HStack(spacing: 10) {
                ForEach(model.state.troupe) { m in
                    PortraitView(member: m, size: 54)
                }
            }
            Text("Tag \(model.state.day)")
                .font(Theme.text(16))
                .foregroundStyle(Theme.pergament.opacity(0.7))
            MainButton(title: "Neu beginnen") { model.restart() }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.dunkel)
    }
}
