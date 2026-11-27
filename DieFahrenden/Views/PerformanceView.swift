import SwiftUI
import GameCore

/// Die Vorstellung: Nummernkarten auf die Bühnenbretter legen (tippen oder
/// ziehen), der goldene Faden zeigt die erwartete Stimmung. Ein Knopf:
/// "Vorhang auf".
struct PerformanceView: View {
    @EnvironmentObject var model: GameModel
    @State private var boards: [String?] = []
    @State private var result: PerformanceResult?
    @State private var playedCount = 0
    @State private var finished = false
    @State private var playback: Task<Void, Never>?

    static let boardWidth: CGFloat = 84
    static let boardSpacing: CGFloat = 10
    private static let secondsPerAct: Double = 1.3

    private var place: Place? { model.currentPlace }
    private var playing: Bool { result != nil && !finished }

    var body: some View {
        if let place {
            content(place)
        } else {
            Color.clear.onAppear { model.leavePerformance() }
        }
    }

    @ViewBuilder
    private func content(_ place: Place) -> some View {
        ZStack {
            GameImage(name: place.kind.stageImage, contentMode: .fill)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipped()
                .ignoresSafeArea()
            LinearGradient(colors: [.black.opacity(0.55), .black.opacity(0.1), .black.opacity(0.7)],
                           startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()

            VStack(spacing: 6) {
                header(place)
                audience(place)
                Spacer(minLength: 0)
                StageArea(place: place,
                          boards: boards,
                          expected: expectedPoints(place),
                          actual: actualPoints(),
                          reactions: reactions(),
                          spotlight: playing ? filledIndices.dropFirst(playedCount).first : nil,
                          onTapBoard: { i in if result == nil { boards[i] = nil } },
                          onDrop: { id, i in put(id, at: i, place: place) })
                Spacer(minLength: 0)
                if result == nil {
                    hand(place)
                } else {
                    Color.clear.frame(height: 98)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)

            if finished, let result {
                Color.black.opacity(0.45).ignoresSafeArea()
                ResultPanel(place: place, result: result) { model.leavePerformance() }
                    .transition(.scale(scale: 0.9).combined(with: .opacity))
            }
        }
        .overlay(alignment: .bottomTrailing) {
            if result == nil {
                let possible = model.state.aliveMembers.contains { Performance.isAllowed($0, at: place) }
                Group {
                    if possible {
                        MainButton(title: "Vorhang auf", enabled: !filledIndices.isEmpty) { start() }
                    } else {
                        MainButton(title: "Weiterziehen") { model.leavePerformance() }
                    }
                }
                .padding(.trailing, 20)
                .padding(.bottom, 110)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { if playing { skip() } }
        .animation(.easeInOut(duration: 0.3), value: finished)
        .onAppear {
            if boards.count != place.kind.stageBoards {
                boards = Array(repeating: nil, count: place.kind.stageBoards)
            }
        }
        .onDisappear { playback?.cancel() }
    }

    // MARK: Teile

    private func header(_ place: Place) -> some View {
        HStack(spacing: 8) {
            GameIcon(name: place.kind.iconName, size: 26)
            Text(place.name)
                .font(Theme.titel(17))
                .foregroundStyle(Theme.hellgold)
            ForEach(place.likes, id: \.self) { GameIcon(name: $0.iconName, size: 20) }
            ForEach(place.banned, id: \.self) { d in
                GameIcon(name: d.iconName, size: 20, tint: .red)
                    .overlay(Rectangle().fill(.red).frame(height: 2).rotationEffect(.degrees(-45)))
            }
            Spacer()
            ResourceBar()
        }
    }

    /// Kleine Figuren in den Farben der Stände, darüber die Wünsche.
    private func audience(_ place: Place) -> some View {
        HStack(spacing: 4) {
            ForEach(Array(place.kind.audience.enumerated()), id: \.offset) { index, figure in
                VStack(spacing: 0) {
                    if index % 3 == 1, let wish = place.likes.first {
                        GameIcon(name: wish.iconName, size: 12)
                    } else {
                        Color.clear.frame(width: 12, height: 12)
                    }
                    GameIcon(name: figure, size: 24, tint: audienceTint(figure))
                }
            }
        }
    }

    private func audienceTint(_ figure: String) -> Color {
        switch figure {
        case "publikum-adel": return Theme.nachtblau
        case "publikum-geistlichkeit": return .white
        default: return Color(red: 0.55, green: 0.38, blue: 0.22)
        }
    }

    private func hand(_ place: Place) -> some View {
        let onStage = Set(boards.compactMap { $0 })
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(model.state.aliveMembers.filter { !onStage.contains($0.id) }) { member in
                    let allowed = Performance.isAllowed(member, at: place)
                    ActCard(member: member, allowed: allowed)
                        .onTapGesture { if allowed { putInFirstFreeBoard(member.id) } }
                        .draggable(member.id) {
                            ActCard(member: member, allowed: true)
                        }
                }
            }
            .padding(.horizontal, 4)
        }
        .frame(height: 98)
    }

    // MARK: Programm legen

    private var filledIndices: [Int] {
        boards.indices.filter { boards[$0] != nil }
    }

    private func putInFirstFreeBoard(_ id: String) {
        if let free = boards.firstIndex(where: { $0 == nil }) {
            withAnimation(.spring(duration: 0.25)) { boards[free] = id }
        }
    }

    private func put(_ id: String, at index: Int, place: Place) {
        guard result == nil, boards.indices.contains(index),
              let member = model.state.member(id), Performance.isAllowed(member, at: place) else { return }
        withAnimation(.spring(duration: 0.25)) {
            if let old = boards.firstIndex(of: id) {
                boards[old] = boards[index] // tauschen
            }
            boards[index] = id
        }
    }

    // MARK: Kurve

    private func expectedPoints(_ place: Place) -> [CurvePoint] {
        let program = filledIndices.compactMap { boards[$0] }.compactMap { model.state.member($0) }
        let curve = Performance.expectedCurve(program: program, place: place, morale: model.state.resources.morale)
        return points(curve: curve)
    }

    private func actualPoints() -> [CurvePoint]? {
        guard let result else { return nil }
        return Array(points(curve: result.curve).prefix(playedCount + 1))
    }

    private func points(curve: [Double]) -> [CurvePoint] {
        var result = [CurvePoint(board: nil, mood: curve.first ?? Performance.startMood)]
        for (k, index) in filledIndices.enumerated() where k + 1 < curve.count {
            result.append(CurvePoint(board: index, mood: curve[k + 1]))
        }
        return result
    }

    private func reactions() -> [Int: String] {
        guard let result else { return [:] }
        var map: [Int: String] = [:]
        for (k, index) in filledIndices.enumerated() where k < playedCount && k < result.acts.count {
            let act = result.acts[k]
            if act.mishap {
                map[index] = "symbol-panne"
            } else if act.delta >= 10 {
                map[index] = "symbol-jubel"
            } else if act.delta < 3 {
                map[index] = "symbol-gaehnen"
            }
        }
        return map
    }

    // MARK: Ablauf

    private func start() {
        let program = filledIndices.compactMap { boards[$0] }
        guard let result = model.perform(program: program) else { return }
        self.result = result
        playedCount = 0
        let total = result.acts.count
        playback = Task { @MainActor in
            for k in 1...max(1, total) {
                try? await Task.sleep(nanoseconds: UInt64(Self.secondsPerAct * 1_000_000_000))
                if Task.isCancelled { return }
                withAnimation(.easeInOut(duration: 0.6)) { playedCount = k }
            }
            try? await Task.sleep(nanoseconds: 700_000_000)
            if !Task.isCancelled { finished = true }
        }
    }

    private func skip() {
        playback?.cancel()
        playedCount = result?.acts.count ?? 0
        finished = true
    }
}

struct CurvePoint: Equatable {
    /// nil = Stimmung vor der ersten Nummer.
    var board: Int?
    var mood: Double
}

/// Bühnenbretter mit dem goldenen Faden darüber.
struct StageArea: View {
    let place: Place
    let boards: [String?]
    let expected: [CurvePoint]
    let actual: [CurvePoint]?
    let reactions: [Int: String]
    let spotlight: Int?
    let onTapBoard: (Int) -> Void
    let onDrop: (String, Int) -> Void

    @EnvironmentObject var model: GameModel

    private let curveHeight: CGFloat = 58
    private var width: CGFloat {
        CGFloat(boards.count) * PerformanceView.boardWidth + CGFloat(max(0, boards.count - 1)) * PerformanceView.boardSpacing
    }

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                curvePath(expected)
                    .stroke(Theme.hellgold.opacity(actual == nil ? 0.95 : 0.3),
                            style: StrokeStyle(lineWidth: actual == nil ? 3 : 2, lineCap: .round, lineJoin: .round,
                                               dash: actual == nil ? [] : [6, 5]))
                    .shadow(color: Theme.gold, radius: actual == nil ? 4 : 0)
                if let actual {
                    curvePath(actual)
                        .stroke(LinearGradient(colors: [Theme.gold, Theme.hellgold], startPoint: .leading, endPoint: .trailing),
                                style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
                        .shadow(color: Theme.hellgold, radius: 6)
                }
                ForEach(Array(reactions.keys), id: \.self) { index in
                    GameIcon(name: reactions[index] ?? "", size: 26)
                        .position(x: x(for: index), y: 12)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .frame(width: width, height: curveHeight)

            HStack(spacing: PerformanceView.boardSpacing) {
                ForEach(boards.indices, id: \.self) { i in
                    board(i)
                }
            }
        }
    }

    private func board(_ i: Int) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(red: 0.36, green: 0.24, blue: 0.14).opacity(0.85))
            RoundedRectangle(cornerRadius: 8)
                .strokeBorder(spotlight == i ? Theme.hellgold : Theme.gold.opacity(0.5),
                              style: StrokeStyle(lineWidth: spotlight == i ? 3 : 1.5, dash: boards[i] == nil ? [5, 4] : []))
            if let id = boards[i], let member = model.state.member(id) {
                ActCard(member: member, allowed: true, compact: true)
                    .draggable(id) { ActCard(member: member, allowed: true) }
            } else {
                Text("\(i + 1)")
                    .font(Theme.titel(22))
                    .foregroundStyle(Theme.gold.opacity(0.4))
            }
        }
        .frame(width: PerformanceView.boardWidth, height: 100)
        .scaleEffect(spotlight == i ? 1.06 : 1)
        .shadow(color: spotlight == i ? Theme.hellgold.opacity(0.7) : .clear, radius: 10)
        .contentShape(Rectangle())
        .onTapGesture { onTapBoard(i) }
        .dropDestination(for: String.self) { items, _ in
            guard let id = items.first else { return false }
            onDrop(id, i)
            return true
        }
    }

    private func x(for board: Int?) -> CGFloat {
        guard let board else { return 0 }
        return CGFloat(board) * (PerformanceView.boardWidth + PerformanceView.boardSpacing) + PerformanceView.boardWidth / 2
    }

    private func y(for mood: Double) -> CGFloat {
        curveHeight - CGFloat(mood / 100) * (curveHeight - 6) - 3
    }

    private func curvePath(_ points: [CurvePoint]) -> Path {
        var path = Path()
        guard let first = points.first else { return path }
        var previous = CGPoint(x: x(for: first.board), y: y(for: first.mood))
        path.move(to: previous)
        for p in points.dropFirst() {
            let next = CGPoint(x: x(for: p.board), y: y(for: p.mood))
            let midX = (previous.x + next.x) / 2
            path.addCurve(to: next,
                          control1: CGPoint(x: midX, y: previous.y),
                          control2: CGPoint(x: midX, y: next.y))
            previous = next
        }
        return path
    }
}

/// Eine Nummernkarte: Porträt, Gefühl und Disziplin.
struct ActCard: View {
    let member: Member
    var allowed: Bool = true
    var compact: Bool = false

    @State private var wiggle = false
    private var tired: Bool { member.fatigue > 60 || member.health < 40 }

    var body: some View {
        VStack(spacing: 3) {
            ZStack(alignment: .bottomTrailing) {
                PortraitView(member: member, size: compact ? 42 : 46)
                if !allowed {
                    GameIcon(name: "symbol-schloss", size: 18, tint: .red)
                }
            }
            Text(member.name)
                .font(Theme.titel(11))
                .lineLimit(1)
            HStack(spacing: 4) {
                GameIcon(name: member.feeling.iconName, size: 16)
                GameIcon(name: member.discipline.iconName, size: 16)
            }
        }
        .foregroundStyle(Theme.pergament)
        .frame(width: 76, height: compact ? 90 : 96)
        .background(compact ? Color.clear : Theme.dunkel.opacity(0.85), in: RoundedRectangle(cornerRadius: 10))
        .overlay {
            if !compact {
                RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.gold.opacity(0.5), lineWidth: 1)
            }
        }
        .opacity(allowed ? (tired ? 0.6 : 1) : 0.4)
        .grayscale(allowed ? 0 : 0.8)
        .rotationEffect(.degrees(tired && wiggle ? 2.5 : 0))
        .onAppear {
            guard tired else { return }
            withAnimation(.easeInOut(duration: 0.18).repeatForever(autoreverses: true)) { wiggle = true }
        }
    }
}

/// Applaus und Lohn, danach geht es zurück auf die Karte.
struct ResultPanel: View {
    let place: Place
    let result: PerformanceResult
    let onContinue: () -> Void
    @EnvironmentObject var model: GameModel

    private var stars: Int { max(1, min(5, Int((result.score / 20).rounded(.up)))) }

    var body: some View {
        VStack(spacing: 14) {
            HStack(spacing: 6) {
                ForEach(0..<5, id: \.self) { i in
                    Image(systemName: i < stars ? "star.fill" : "star")
                        .font(.system(size: 26))
                        .foregroundStyle(Theme.hellgold)
                }
            }
            HStack(spacing: 16) {
                ResourceChanges(change: result.reward)
                if result.healing > 0 {
                    ChangeBadge(icon: "symbol-pflege", amount: result.healing)
                }
            }
            if place.kind != .monastery {
                HStack(spacing: 12) {
                    ForEach(Goods.allCases, id: \.self) { goods in
                        Button { model.buy(goods) } label: {
                            HStack(spacing: 6) {
                                ChangeBadge(icon: "symbol-muenze", amount: -goods.deal.price)
                                Image(systemName: "arrow.right").font(.system(size: 12))
                                ChangeBadge(icon: goods == .food ? "symbol-brot" : "symbol-holz", amount: goods.deal.amount)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(.black.opacity(0.5), in: Capsule())
                            .overlay(Capsule().strokeBorder(Theme.gold.opacity(0.5)))
                        }
                        .buttonStyle(.plain)
                        .disabled(!model.state.canBuy(goods))
                        .opacity(model.state.canBuy(goods) ? 1 : 0.4)
                    }
                }
                ResourceBar()
            }
            MainButton(title: "Weiter", action: onContinue)
        }
        .padding(22)
        .foregroundStyle(Theme.pergament)
        .background(Theme.dunkel.opacity(0.92), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(Theme.gold.opacity(0.7), lineWidth: 1.5))
    }
}
