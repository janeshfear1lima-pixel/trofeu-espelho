import SwiftUI
import ReplayKit

@main
struct TrofeuApp: App {
    var body: some Scene { WindowGroup { ContentView() } }
}

struct ContentView: View {
    @State private var ip = localIP() ?? "sem Wi‑Fi"
    private let blue = Color(red: 0.12, green: 0.53, blue: 0.98)

    var body: some View {
        ZStack {
            Color(white: 0.97).ignoresSafeArea()
            VStack(spacing: 18) {
                Spacer()
                Image(systemName: "trophy.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(LinearGradient(colors: [Color(red: 1, green: 0.8, blue: 0.2), Color(red: 0.9, green: 0.55, blue: 0.05)],
                                                    startPoint: .top, endPoint: .bottom))
                Text("Trofeu Espelho").font(.system(size: 28, weight: .bold))
                Text("Espelhe a tela do iPhone no PC").foregroundColor(.secondary)

                ZStack {
                    RoundedRectangle(cornerRadius: 16).fill(LinearGradient(colors: [blue, Color(red: 0.35, green: 0.45, blue: 1)],
                                                                          startPoint: .leading, endPoint: .trailing))
                    Text("Iniciar espelhamento").font(.headline).foregroundColor(.white).allowsHitTesting(false)
                    BroadcastPicker()
                }
                .frame(width: 270, height: 58)
                .padding(.top, 10)

                VStack(alignment: .leading, spacing: 10) {
                    step("1", "Conecte o cabo no PC (ou use o mesmo Wi‑Fi)")
                    step("2", "Abra o Trofeu Espelho no PC")
                    step("3", "Toque em Iniciar espelhamento → Iniciar Transmissão")
                }
                .padding(18)
                .background(RoundedRectangle(cornerRadius: 14).fill(Color.white))
                .padding(.horizontal, 24)

                Text("IP deste iPhone: \(ip)").font(.footnote).foregroundColor(.secondary)
                    .onTapGesture { ip = localIP() ?? "sem Wi‑Fi" }
                Spacer()
            }
        }
    }

    private func step(_ n: String, _ t: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(n).font(.caption.bold()).foregroundColor(.white).frame(width: 22, height: 22).background(Circle().fill(blue))
            Text(t).font(.subheadline)
        }
    }
}

struct BroadcastPicker: UIViewRepresentable {
    func makeUIView(context: Context) -> RPSystemBroadcastPickerView {
        let v = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 270, height: 58))
        v.preferredExtension = (Bundle.main.bundleIdentifier ?? "com.trofeu.espelho") + ".broadcast"
        v.showsMicrophoneButton = false
        return v
    }
    func updateUIView(_ v: RPSystemBroadcastPickerView, context: Context) {
        DispatchQueue.main.async {
            for case let b as UIButton in v.subviews {
                b.setImage(nil, for: .normal)
                b.frame = v.bounds
                b.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            }
        }
    }
}

func localIP() -> String? {
    var addr: String?
    var ifaddr: UnsafeMutablePointer<ifaddrs>?
    guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return nil }
    defer { freeifaddrs(ifaddr) }
    for p in sequence(first: first, next: { $0.pointee.ifa_next }) {
        let i = p.pointee
        guard i.ifa_addr.pointee.sa_family == UInt8(AF_INET), String(cString: i.ifa_name) == "en0" else { continue }
        var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
        getnameinfo(i.ifa_addr, socklen_t(i.ifa_addr.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST)
        addr = String(cString: host)
    }
    return addr
}
