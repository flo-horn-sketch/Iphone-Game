import SwiftUI
import GameCore

/// Die Karte einer Region: größer als der Bildschirm, mit einem Finger
/// verschieben, mit zwei Fingern zoomen. Orte und Wege kommen aus welt.json,
/// das Kartenbild selbst ist nur der Hintergrund.
struct RegionMapView: View {
    let regionID: String
    @EnvironmentObject var model: GameModel
    @State private var zoom: CGFloat = 1.4
    @State private var baseZoom: CGFloat = 1.4
    @State private var wagonProgress: CGFloat = 0
    @State private var coordinateHint: String?

    private static let travelSeconds: Double = 2.2

    private var region: Region? { model.world.region(regionID) }
    private var places: [Place] { model.world.places(in: regionID) }

    var body: some View {
        GeometryReader { geo in
            let mapName = region?.mapImage ?? "karte-mittelreich"
            let aspect = ImageStore.aspectRatio(mapName)
            let height = max(geo.size.height, geo.size.width / aspect) * zoom
            let mapSize = CGSize(width: height * aspect, height: height)

            ScrollViewReader { proxy in
                ScrollView([.horizontal, .vertical], showsIndicators: false) {
                    mapContent(mapName: mapName, size: mapSize)
                        .frame(width: mapSize.width, height: mapSize.height)
                }
                .onAppear {
                    DispatchQueue.main.async {
                        proxy.scrollTo(model.state.location, anchor: .center)
                    }
                }
            }
        }
        .ignoresSafeArea()
        .simultaneousGesture(
            MagnifyGesture()
                .onChanged { value in
                    zoom = min(3, max(1, baseZoom * value.magnification))
                }
                .onEnded { _ in baseZoom = zoom }
        )
        .overlay(alignment: .topLeading) { header }
        .overlay(alignment: .top) { ResourceBar().padding(.top, 8) }
        .overlay(alignment: .bottomLeading) { PortraitBar().padding(12) }
        .overlay(alignment: .bottomTrailing) {
            if let id = model.selectedPlace, let place = model.world.place(id), model.journey == nil {
                PlaceInfoPanel(place: place)
                    .padding(12)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
        .overlay(alignment: .bottom) {
            if let hint = coordinateHint {
                Text(hint)
                    .font(.system(.footnote, design: .monospaced))
                    .padding(8)
                    .background(.black.opacity(0.7), in: RoundedRectangle(cornerRadius: 8))
                    .padding(.bottom, 70)
            }
        }
        .animation(.easeOut(duration: 0.2), value: model.selectedPlace)
        .onChange(of: model.journey) { _, journey in
            guard journey != nil else { return }
            withAnimation(.easeInOut(duration: Self.travelSeconds)) { wagonProgress = 1 }
            DispatchQueue.main.asyncAfter(deadline: .now() + Self.travelSeconds + 0.2) {
                model.journeyFinished()
                wagonProgress = 0
            }
        }
    }

    private var header: some View {
        HStack(spacing: 8) {
            Button { model.openWorld() } label: {
                Image(systemName: "globe.europe.africa.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(Theme.hellgold)
                    .padding(9)
                    .background(.black.opacity(0.55), in: Circle())
            }
            .accessibilityLabel("Weltkarte")
            Text(region?.name ?? "")
                .font(Theme.titel(16))
                .foregroundStyle(Theme.hellgold)
        }
        .padding(10)
    }

    // MARK: Karteninhalt

    @ViewBuilder
    private func mapContent(mapName: String, size: CGSize) -> some View {
        ZStack(alignment: .topLeading) {
            GameImage(name: mapName, contentMode: .fill)
                .frame(width: size.width, height: size.height)
                .clipped()
                .contentShape(Rectangle())
                .onTapGesture(coordinateSpace: .local) { location in
                    model.selectedPlace = nil
                    #if DEBUG
                    // Hilfe zum Platzieren: zeigt die Position als Anteil des Kartenbildes.
                    let x = (location.x / size.width * 100).rounded() / 100
                    let y = (location.y / size.height * 100).rounded() / 100
                    coordinateHint = "\"position\": { \"x\": \(x), \"y\": \(y) }"
                    print("Kartenposition:", coordinateHint ?? "")
                    #endif
                }

            roads(size: size)
                .allowsHitTesting(false)

            ForEach(places) { place in
                PlaceMarker(place: place,
                            isHere: place.id == model.state.location && model.journey == nil,
                            reachable: model.road(to: place.id) != nil,
                            selected: model.selectedPlace == place.id)
                    .id(place.id)
                    .position(point(place.position, size))
                    .onTapGesture {
                        guard model.journey == nil else { return }
                        model.selectedPlace = place.id
                    }
            }

            GameIcon(name: "wagen", size: 46)
                .shadow(color: .black.opacity(0.6), radius: 3, y: 2)
                .position(wagonPoint(size))
                .allowsHitTesting(false)
        }
    }

    private func roads(size: CGSize) -> some View {
        Canvas { context, _ in
            for road in model.world.roads {
                guard let a = model.world.place(road.from), let b = model.world.place(road.to),
                      a.region == regionID, b.region == regionID else { continue }
                let p1 = point(a.position, size)
                let p2 = point(b.position, size)
                var path = Path()
                path.move(to: p1)
                path.addLine(to: p2)
                let fromHere = road.from == model.state.location || road.to == model.state.location
                let color = fromHere ? Theme.hellgold : Theme.tinte.opacity(0.8)
                let style = StrokeStyle(lineWidth: fromHere ? 5 : 3, lineCap: .round,
                                        dash: road.kind == .forest ? [10, 8] : [])
                context.stroke(path, with: .color(.black.opacity(0.35)), style: StrokeStyle(lineWidth: style.lineWidth + 3, lineCap: .round, dash: style.dash))
                context.stroke(path, with: .color(color), style: style)

                // Reisetage als kleine Zahl in der Mitte des Weges
                let mid = CGPoint(x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2)
                let circle = Path(ellipseIn: CGRect(x: mid.x - 11, y: mid.y - 11, width: 22, height: 22))
                context.fill(circle, with: .color(Theme.dunkel.opacity(0.85)))
                context.stroke(circle, with: .color(color), lineWidth: 1.5)
                context.draw(Text("\(road.days)").font(Theme.titel(13)).foregroundColor(Theme.pergament), at: mid)
            }
        }
        .frame(width: size.width, height: size.height)
    }

    private func point(_ p: MapPoint, _ size: CGSize) -> CGPoint {
        CGPoint(x: p.x * size.width, y: p.y * size.height)
    }

    /// Der Wagen steht über dem aktuellen Ort oder fährt gerade.
    private func wagonPoint(_ size: CGSize) -> CGPoint {
        let lift: CGFloat = 36
        if let j = model.journey, let a = model.world.place(j.from), let b = model.world.place(j.to) {
            let p1 = point(a.position, size)
            let p2 = point(b.position, size)
            return CGPoint(x: p1.x + (p2.x - p1.x) * wagonProgress,
                           y: p1.y + (p2.y - p1.y) * wagonProgress - lift)
        }
        let here = model.world.place(model.state.location)?.position ?? MapPoint(x: 0.5, y: 0.5)
        let p = point(here, size)
        return CGPoint(x: p.x, y: p.y - lift)
    }
}

struct PlaceMarker: View {
    let place: Place
    let isHere: Bool
    let reachable: Bool
    let selected: Bool

    var body: some View {
        VStack(spacing: 2) {
            GameIcon(name: place.kind.iconName, size: selected ? 54 : 44,
                     tint: reachable || isHere ? Theme.hellgold : Theme.pergament.opacity(0.7))
                .shadow(color: selected ? Theme.hellgold : .black.opacity(0.5), radius: selected ? 8 : 3)
            Text(place.name)
                .font(Theme.titel(12))
                .foregroundStyle(Theme.pergament)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(.black.opacity(0.55), in: Capsule())
        }
        .opacity(reachable || isHere ? 1 : 0.7)
        .animation(.spring(duration: 0.25), value: selected)
        .contentShape(Rectangle())
    }
}

/// Tafel unten rechts: Reisedauer, Geschmack des Publikums, Warnungen und
/// genau ein Knopf.
struct PlaceInfoPanel: View {
    let place: Place
    @EnvironmentObject var model: GameModel

    var body: some View {
        let road = model.road(to: place.id)
        let isHere = place.id == model.state.location
        let mouths = model.state.aliveMembers.count

        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                GameIcon(name: place.kind.iconName, size: 30)
                VStack(alignment: .leading, spacing: 0) {
                    Text(place.name).font(Theme.titel(17))
                    Text(place.kind.displayName).font(Theme.text(12)).foregroundStyle(Theme.pergament.opacity(0.6))
                }
            }
            HStack(spacing: 6) {
                ForEach(place.likes, id: \.self) { feeling in
                    GameIcon(name: feeling.iconName, size: 22)
                }
                ForEach(place.banned, id: \.self) { d in
                    GameIcon(name: d.iconName, size: 22, tint: .red)
                        .overlay(Rectangle().fill(.red).frame(height: 2).rotationEffect(.degrees(-45)))
                }
                ForEach(0..<min(place.kind.stageBoards, 6), id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 2).fill(Theme.gold.opacity(0.7)).frame(width: 6, height: 14)
                }
            }
            if let road {
                HStack(spacing: 10) {
                    HStack(spacing: 3) {
                        GameIcon(name: "symbol-tag", size: 18)
                        Text("\(road.days)").font(Theme.titel(15))
                    }
                    ChangeBadge(icon: "symbol-brot", amount: -road.days * mouths)
                    ChangeBadge(icon: "symbol-holz", amount: -road.days)
                    if road.kind == .forest {
                        GameIcon(name: "symbol-wald", size: 18)
                        GameIcon(name: "symbol-gefahr", size: 18, tint: .orange)
                    }
                }
                MainButton(title: "Aufbrechen") { model.departTo(place.id) }
            } else if isHere {
                GameIcon(name: "wagen", size: 28)
            } else {
                HStack(spacing: 4) {
                    GameIcon(name: "symbol-schloss", size: 16, tint: Theme.pergament.opacity(0.6))
                    Text("Kein direkter Weg").font(Theme.text(13)).foregroundStyle(Theme.pergament.opacity(0.6))
                }
            }
        }
        .padding(14)
        .foregroundStyle(Theme.pergament)
        .background(Theme.dunkel.opacity(0.88), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Theme.gold.opacity(0.6), lineWidth: 1))
        .frame(maxWidth: 300)
    }
}
