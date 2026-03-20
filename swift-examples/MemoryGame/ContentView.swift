import SwiftUI

struct ContentView: View {
    @StateObject private var vm = GameViewModel()

    // iPad: 4 columns, iPhone: 4 columns (adjusts card size via GeometryReader)
    let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 4)

    var body: some View {
        NavigationStack {
            ZStack {
                // Background
                LinearGradient(
                    colors: [Color(hex: "#1a1a2e"), Color(hex: "#16213e"), Color(hex: "#0f3460")],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                VStack(spacing: 20) {
                    // Stats bar
                    HStack(spacing: 30) {
                        StatBadge(icon: "star.fill", label: "分數", value: "\(vm.score)", color: .yellow)
                        StatBadge(icon: "arrow.2.squarepath", label: "步數", value: "\(vm.moves)", color: .cyan)
                        StatBadge(icon: "clock.fill", label: "時間", value: vm.timeString, color: .green)
                    }
                    .padding(.horizontal)

                    // Card grid
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(vm.cards) { card in
                            CardView(card: card)
                                .aspectRatio(2/3, contentMode: .fit)
                                .onTapGesture { vm.flip(card) }
                        }
                    }
                    .padding(.horizontal)

                    // New game button
                    Button(action: { vm.newGame() }) {
                        Label("重新開始", systemImage: "arrow.clockwise")
                            .font(.headline)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 28)
                            .padding(.vertical, 12)
                            .background(Color(hex: "#e94560").cornerRadius(25))
                            .shadow(color: Color(hex: "#e94560").opacity(0.5), radius: 8)
                    }
                }
                .padding(.vertical)

                // Game over overlay
                if vm.isGameOver {
                    GameOverView(vm: vm)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .navigationTitle("記憶翻牌")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color(hex: "#1a1a2e"), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }
}

// MARK: - Card View

struct CardView: View {
    let card: Card
    @State private var rotation: Double = 0

    var body: some View {
        ZStack {
            if card.isFaceUp || card.isMatched {
                // Front
                RoundedRectangle(cornerRadius: 12)
                    .fill(
                        card.isMatched
                            ? LinearGradient(colors: [Color(hex: "#00b09b"), Color(hex: "#96c93d")],
                                             startPoint: .topLeading, endPoint: .bottomTrailing)
                            : LinearGradient(colors: [Color(hex: "#f7971e"), Color(hex: "#ffd200")],
                                             startPoint: .topLeading, endPoint: .bottomTrailing)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(.white.opacity(0.3), lineWidth: 1)
                    )
                Text(card.emoji)
                    .font(.system(size: 44))
                    .scaleEffect(card.isMatched ? 1.15 : 1.0)
                    .animation(.spring(response: 0.3, dampingFraction: 0.5), value: card.isMatched)
            } else {
                // Back
                RoundedRectangle(cornerRadius: 12)
                    .fill(
                        LinearGradient(colors: [Color(hex: "#434343"), Color(hex: "#000000")],
                                       startPoint: .topLeading, endPoint: .bottomTrailing)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(Color(hex: "#e94560").opacity(0.6), lineWidth: 1.5)
                    )
                Text("❓")
                    .font(.system(size: 36))
                    .opacity(0.5)
            }
        }
        .rotation3DEffect(.degrees(card.isFaceUp || card.isMatched ? 0 : 180), axis: (0, 1, 0))
        .animation(.spring(response: 0.35, dampingFraction: 0.7), value: card.isFaceUp)
        .shadow(color: card.isMatched ? Color(hex: "#00b09b").opacity(0.5) : .black.opacity(0.4),
                radius: 6, x: 0, y: 4)
    }
}

// MARK: - Stat Badge

struct StatBadge: View {
    let icon: String
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon).foregroundStyle(color)
            Text(value).font(.title2.bold()).foregroundStyle(.white)
            Text(label).font(.caption).foregroundStyle(.white.opacity(0.6))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(.white.opacity(0.05))
        .cornerRadius(12)
    }
}

// MARK: - Game Over View

struct GameOverView: View {
    @ObservedObject var vm: GameViewModel

    var body: some View {
        VStack(spacing: 24) {
            Text("完成！").font(.system(size: 48, weight: .heavy)).foregroundStyle(.white)

            // Stars
            HStack(spacing: 8) {
                ForEach(1...3, id: \.self) { i in
                    Image(systemName: i <= vm.stars ? "star.fill" : "star")
                        .font(.system(size: 40))
                        .foregroundStyle(i <= vm.stars ? .yellow : .gray.opacity(0.5))
                        .scaleEffect(i <= vm.stars ? 1.2 : 1.0)
                        .animation(.spring(response: 0.4).delay(Double(i) * 0.15), value: vm.isGameOver)
                }
            }

            VStack(spacing: 8) {
                Text("分數：\(vm.score)").font(.title2.bold()).foregroundStyle(.yellow)
                Text("步數：\(vm.moves) 步").font(.headline).foregroundStyle(.white.opacity(0.8))
                Text("時間：\(vm.timeString)").font(.headline).foregroundStyle(.cyan)
            }

            Button(action: { withAnimation { vm.newGame() } }) {
                Text("再玩一次")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 40)
                    .padding(.vertical, 14)
                    .background(Color(hex: "#e94560").cornerRadius(30))
                    .shadow(color: Color(hex: "#e94560").opacity(0.5), radius: 10)
            }
        }
        .padding(40)
        .background(
            RoundedRectangle(cornerRadius: 28)
                .fill(.ultraThinMaterial)
                .overlay(RoundedRectangle(cornerRadius: 28).strokeBorder(.white.opacity(0.2), lineWidth: 1))
        )
        .padding(32)
    }
}

// MARK: - Color Hex Extension

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8) & 0xFF) / 255
        let b = Double(int & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

#Preview {
    ContentView()
}
