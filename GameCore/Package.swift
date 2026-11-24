// swift-tools-version:5.9
import PackageDescription

// Die Spiellogik von "Die Fahrenden". Sie kennt keine Oberfläche und keine
// Bilder, deshalb lässt sie sich mit `swift test` überall testen.
let package = Package(
    name: "GameCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "GameCore", targets: ["GameCore"])
    ],
    targets: [
        .target(
            name: "GameCore",
            resources: [.process("Resources")]
        ),
        .testTarget(
            name: "GameCoreTests",
            dependencies: ["GameCore"]
        )
    ]
)
