import SwiftUI
import GameCore

/// Die Weltkarte mit den fünf Regionen. Ein Tippen auf eine offene Region
/// öffnet deren eigene Karte.
struct WorldMapView: View {
    @EnvironmentObject var model: GameModel
    @State private var showGrafiken = false
    @State private var shaking: String?

    var body: some View {
        GeometryReader { geo in
            let aspect = ImageStore.aspectRatio("karte-welt")
            // Die Weltkarte passt immer ganz auf den Bildschirm.
            let size = fitted(aspect: aspect, in: geo.size)
            ZStack {
                ZStack(alignment: .topLeading) {
                    GameImage(name: "karte-welt", contentMode: .fill)
                        .frame(width: size.width, height: size.height)
                        .clipped()
                    ForEach(model.world.regions) { region in
                        RegionMarker(region: region,
                                     isHere: region.id == model.currentRegion,
                                     shaking: shaking == region.id)
                            .position(x: region.worldPosition.x * size.width,
                                      y: region.worldPosition.y * size.height)
                            .onTapGesture { tap(region) }
                    }
                }
                .frame(width: size.width, height: size.height)
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .ignoresSafeArea()
        .overlay(alignment: .top) {
            ResourceBar().padding(.top, 8)
        }
        .overlay(alignment: .bottomLeading) {
            PortraitBar().padding(12)
        }
        .overlay(alignment: .topTrailing) {
            #if DEBUG
            Button { showGrafiken = true } label: {
                Image(systemName: "photo.on.rectangle.angled")
                    .font(.system(size: 18))
                    .padding(10)
                    .background(.black.opacity(0.5), in: Circle())
            }
            .padding(10)
            .accessibilityLabel("Grafik-Übersicht")
            #endif
        }
        .sheet(isPresented: $showGrafiken) {
            GrafikUebersicht()
        }
    }

    private func tap(_ region: Region) {
        if region.isOpen {
            model.openRegion(region.id)
        } else {
            withAnimation(.default) { shaking = region.id }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { shaking = nil }
        }
    }

    private func fitted(aspect: CGFloat, in size: CGSize) -> CGSize {
        if size.width / size.height > aspect {
            return CGSize(width: size.height * aspect, height: size.height)
        }
        return CGSize(width: size.width, height: size.width / aspect)
    }
}

struct RegionMarker: View {
    let region: Region
    let isHere: Bool
    let shaking: Bool

    var body: some View {
        VStack(spacing: 2) {
            if isHere {
                GameIcon(name: "wagen", size: 34)
            } else if !region.isOpen {
                GameIcon(name: "symbol-schloss", size: 22, tint: Theme.pergament.opacity(0.7))
            }
            Text(region.name)
                .font(Theme.titel(15))
                .foregroundStyle(region.isOpen ? Theme.hellgold : Theme.pergament.opacity(0.55))
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(.black.opacity(region.isOpen ? 0.6 : 0.4), in: Capsule())
        }
        .offset(x: shaking ? 6 : 0)
        .animation(shaking ? .easeInOut(duration: 0.06).repeatCount(5, autoreverses: true) : .default, value: shaking)
        .contentShape(Rectangle())
    }
}

/// Zeigt alle Bilder aus der Grafikliste und ob sie schon im Spiel liegen.
/// Nur in der Entwicklungsversion sichtbar.
struct GrafikUebersicht: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                let vorhanden = GrafikListe.alle.filter { ImageStore.image($0.name) != nil }.count
                Section {
                    Text("\(vorhanden) von \(GrafikListe.alle.count) Bildern vorhanden")
                }
                ForEach(GrafikSpec.Gruppe.allCases, id: \.self) { gruppe in
                    Section(gruppe.rawValue) {
                        ForEach(GrafikListe.alle.filter { $0.gruppe == gruppe }) { spec in
                            HStack(spacing: 12) {
                                GameImage(name: spec.name, contentMode: .fit)
                                    .frame(width: 60, height: 40)
                                VStack(alignment: .leading) {
                                    Text(spec.name + ".png").font(.system(.body, design: .monospaced))
                                    Text(spec.groesse + (spec.transparent ? " · transparent" : ""))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: ImageStore.image(spec.name) != nil ? "checkmark.circle.fill" : "circle.dashed")
                                    .foregroundStyle(ImageStore.image(spec.name) != nil ? .green : .secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Grafiken")
            .toolbar {
                Button("Fertig") { dismiss() }
            }
        }
    }
}
