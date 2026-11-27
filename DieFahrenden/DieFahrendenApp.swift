import SwiftUI

@main
struct DieFahrendenApp: App {
    @StateObject private var model = GameModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .preferredColorScheme(.dark)
                .statusBarHidden()
                .persistentSystemOverlays(.hidden)
        }
    }
}
