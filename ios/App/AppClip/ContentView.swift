import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack {
            Image(systemName: "house.fill")
                .imageScale(.large)
                .foregroundColor(.purple)
            Text("KOLO")
                .font(.largeTitle)
                .bold()
            Text("AI Real Estate")
                .foregroundColor(.gray)
        }
    }
}
