import Foundation

struct Card: Identifiable {
    let id: Int
    let emoji: String
    var isFaceUp: Bool = false
    var isMatched: Bool = false
}
