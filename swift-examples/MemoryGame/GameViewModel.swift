import Foundation
import Combine

class GameViewModel: ObservableObject {
    @Published var cards: [Card] = []
    @Published var score: Int = 0
    @Published var moves: Int = 0
    @Published var isGameOver: Bool = false
    @Published var elapsedTime: Int = 0

    private var firstFlippedIndex: Int? = nil
    private var isProcessing = false
    private var timer: AnyCancellable?

    let emojis = ["🐶","🐱","🦊","🐻","🐼","🦁","🐯","🐸",
                   "🦋","🐙","🦀","🐬","🦄","🐲","🦖","🦩"]

    init() {
        newGame()
    }

    func newGame() {
        let chosen = Array(emojis.shuffled().prefix(8))
        let doubled = (chosen + chosen).shuffled()
        cards = doubled.enumerated().map { Card(id: $0.offset, emoji: $0.element) }
        score = 0
        moves = 0
        elapsedTime = 0
        isGameOver = false
        firstFlippedIndex = nil
        isProcessing = false
        startTimer()
    }

    func flip(_ card: Card) {
        guard !isProcessing else { return }
        guard let idx = cards.firstIndex(where: { $0.id == card.id }) else { return }
        guard !cards[idx].isFaceUp && !cards[idx].isMatched else { return }

        cards[idx].isFaceUp = true

        if let first = firstFlippedIndex {
            // Second card flipped
            moves += 1
            isProcessing = true

            if cards[first].emoji == cards[idx].emoji {
                // Match!
                score += 10
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.cards[first].isMatched = true
                    self.cards[idx].isMatched = true
                    self.firstFlippedIndex = nil
                    self.isProcessing = false
                    self.checkGameOver()
                }
            } else {
                // No match — flip back
                score = max(0, score - 1)
                let firstCopy = first
                let idxCopy = idx
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                    self.cards[firstCopy].isFaceUp = false
                    self.cards[idxCopy].isFaceUp = false
                    self.firstFlippedIndex = nil
                    self.isProcessing = false
                }
            }
        } else {
            firstFlippedIndex = idx
        }
    }

    private func checkGameOver() {
        if cards.allSatisfy({ $0.isMatched }) {
            isGameOver = true
            timer?.cancel()
        }
    }

    private func startTimer() {
        timer?.cancel()
        timer = Timer.publish(every: 1, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.elapsedTime += 1
            }
    }

    var timeString: String {
        let m = elapsedTime / 60
        let s = elapsedTime % 60
        return String(format: "%02d:%02d", m, s)
    }

    var stars: Int {
        switch moves {
        case ..<10: return 3
        case 10..<16: return 2
        default: return 1
        }
    }
}
