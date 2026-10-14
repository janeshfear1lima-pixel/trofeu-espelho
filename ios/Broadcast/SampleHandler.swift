import ReplayKit
import VideoToolbox
import Network
import UIKit

// Protocolo: [tipo 1 byte][tamanho 4 bytes BE][dados]
// iPhone -> PC: 1 hello(JSON) | 2 vídeo [key 1][pts 8][annexB] | 3 áudio [rate 4][canais 1][PCM int16 LE] | 4 rotação [graus 2]
// PC -> iPhone: 16 config(JSON) | 17 pedir keyframe
let kPort: UInt16 = 7878

final class MirrorServer {
    private var listener: NWListener?
    private var conn: NWConnection?
    private let q = DispatchQueue(label: "trofeu.net")
    private var pending = 0
    var onClient: (() -> Void)?
    var onMessage: ((UInt8, Data) -> Void)?

    var hasClient: Bool { q.sync { conn != nil } }
    var isBusy: Bool { q.sync { pending > 3 } }

    func start() {
        let params = NWParameters.tcp
        params.allowLocalEndpointReuse = true
        if let tcp = params.defaultProtocolStack.transportProtocol as? NWProtocolTCP.Options { tcp.noDelay = true }
        guard let l = try? NWListener(using: params, on: NWEndpoint.Port(rawValue: kPort)!) else { return }
        l.service = NWListener.Service(name: UIDevice.current.name, type: "_trofeu._tcp")
        l.newConnectionHandler = { [weak self] c in self?.accept(c) }
        l.start(queue: q)
        listener = l
    }

    func stop() { q.sync { conn?.cancel(); conn = nil; listener?.cancel(); listener = nil } }

    private func accept(_ c: NWConnection) {
        conn?.cancel()
        conn = c
        pending = 0
        c.stateUpdateHandler = { [weak self, weak c] st in
            guard let self, let c else { return }
            switch st {
            case .ready: self.onClient?()
            case .failed, .cancelled: if self.conn === c { self.conn = nil }
            default: break
            }
        }
        c.start(queue: q)
        receive(c)
    }

    private func receive(_ c: NWConnection) {
        c.receive(minimumIncompleteLength: 5, maximumLength: 5) { [weak self] head, _, done, err in
            guard let self, let head, head.count == 5, err == nil else { if done || err != nil { c.cancel() }; return }
            let b = [UInt8](head)
            let len = Int(b[1]) << 24 | Int(b[2]) << 16 | Int(b[3]) << 8 | Int(b[4])
            if len == 0 { self.onMessage?(b[0], Data()); self.receive(c); return }
            c.receive(minimumIncompleteLength: len, maximumLength: len) { body, _, _, err2 in
                guard let body, err2 == nil else { c.cancel(); return }
                self.onMessage?(b[0], body)
                self.receive(c)
            }
        }
    }

    func send(_ type: UInt8, _ payload: Data) {
        q.async {
            guard let c = self.conn else { return }
            var f = Data([type])
            var len = UInt32(payload.count).bigEndian
            f.append(Data(bytes: &len, count: 4))
            f.append(payload)
            self.pending += 1
            c.send(content: f, completion: .contentProcessed { [weak self] _ in self?.pending -= 1 })
        }
    }
}

final class H264Encoder {
    private var session: VTCompressionSession?
    private var width = 0, height = 0
    private var transfer: VTPixelTransferSession?
    private var pool: CVPixelBufferPool?
    private var poolW = 0, poolH = 0
    private var forceKey = true
    private var dirty = false
    var fps = 60, bitrate = 10_000_000, shortSide = 1080 // 0 = nativa
    var onFrame: ((Data, Bool, Int64) -> Void)?

    func requestKey() { forceKey = true }
    func configure(fps: Int, bitrate: Int, shortSide: Int) {
        self.fps = fps; self.bitrate = bitrate; self.shortSide = shortSide; dirty = true; forceKey = true
    }
    func reset() {
        if let s = session { VTCompressionSessionInvalidate(s) }
        session = nil
    }

    private func make(_ w: Int, _ h: Int) {
        reset()
        var s: VTCompressionSession?
        VTCompressionSessionCreate(allocator: nil, width: Int32(w), height: Int32(h), codecType: kCMVideoCodecType_H264,
                                   encoderSpecification: nil, imageBufferAttributes: nil, compressedDataAllocator: nil,
                                   outputCallback: nil, refcon: nil, compressionSessionOut: &s)
        guard let s else { return }
        VTSessionSetProperty(s, key: kVTCompressionPropertyKey_RealTime, value: kCFBooleanTrue)
        VTSessionSetProperty(s, key: kVTCompressionPropertyKey_ProfileLevel, value: kVTProfileLevel_H264_High_AutoLevel)
        VTSessionSetProperty(s, key: kVTCompressionPropertyKey_AllowFrameReordering, value: kCFBooleanFalse)
        VTSessionSetProperty(s, key: kVTCompressionPropertyKey_AverageBitRate, value: bitrate as CFNumber)
        VTSessionSetProperty(s, key: kVTCompressionPropertyKey_DataRateLimits, value: [bitrate / 4, 1] as CFArray)
        VTSessionSetProperty(s, key: kVTCompressionPropertyKey_ExpectedFrameRate, value: fps as CFNumber)
        VTSessionSetProperty(s, key: kVTCompressionPropertyKey_MaxKeyFrameInterval, value: (fps * 2) as CFNumber)
        VTSessionSetProperty(s, key: kVTCompressionPropertyKey_MaxKeyFrameIntervalDuration, value: 2 as CFNumber)
        VTCompressionSessionPrepareToEncodeFrames(s)
        session = s; width = w; height = h; dirty = false; forceKey = true
    }

    private func scale(_ src: CVPixelBuffer, _ w: Int, _ h: Int) -> CVPixelBuffer? {
        if transfer == nil { VTPixelTransferSessionCreate(allocator: nil, pixelTransferSessionOut: &transfer) }
        if pool == nil || poolW != w || poolH != h {
            let attrs: [CFString: Any] = [
                kCVPixelBufferPixelFormatTypeKey: CVPixelBufferGetPixelFormatType(src),
                kCVPixelBufferWidthKey: w, kCVPixelBufferHeightKey: h,
                kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary]
            pool = nil
            CVPixelBufferPoolCreate(nil, nil, attrs as CFDictionary, &pool)
            poolW = w; poolH = h
        }
        guard let pool, let transfer else { return nil }
        var dst: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, pool, &dst)
        guard let dst else { return nil }
        return VTPixelTransferSessionTransferImage(transfer, from: src, to: dst) == noErr ? dst : nil
    }

    func encode(_ sb: CMSampleBuffer) {
        guard let pb = CMSampleBufferGetImageBuffer(sb) else { return }
        let sw = CVPixelBufferGetWidth(pb), sh = CVPixelBufferGetHeight(pb)
        var tw = sw, th = sh
        if shortSide > 0, min(sw, sh) > shortSide {
            let k = Double(shortSide) / Double(min(sw, sh))
            tw = Int(Double(sw) * k) & ~1; th = Int(Double(sh) * k) & ~1
        }
        if session == nil || dirty || tw != width || th != height { make(tw, th) }
        guard let s = session else { return }
        var input = pb
        if tw != sw || th != sh, let scaled = scale(pb, tw, th) { input = scaled }
        var props: CFDictionary?
        if forceKey { props = [kVTEncodeFrameOptionKey_ForceKeyFrame: true] as CFDictionary; forceKey = false }
        let pts = CMSampleBufferGetPresentationTimeStamp(sb)
        VTCompressionSessionEncodeFrame(s, imageBuffer: input, presentationTimeStamp: pts, duration: .invalid,
                                        frameProperties: props, infoFlagsOut: nil) { [weak self] status, _, out in
            guard status == noErr, let out else { return }
            self?.emit(out)
        }
    }

    private func emit(_ sb: CMSampleBuffer) {
        let atts = CMSampleBufferGetSampleAttachmentsArray(sb, createIfNecessary: false) as? [[CFString: Any]]
        let key = !((atts?.first?[kCMSampleAttachmentKey_NotSync] as? Bool) ?? false)
        let start: [UInt8] = [0, 0, 0, 1]
        var out = Data()
        if key, let fmt = CMSampleBufferGetFormatDescription(sb) {
            var count = 0
            CMVideoFormatDescriptionGetH264ParameterSetAtIndex(fmt, parameterSetIndex: 0, parameterSetPointerOut: nil,
                                                               parameterSetSizeOut: nil, parameterSetCountOut: &count, nalUnitHeaderLengthOut: nil)
            for i in 0..<count {
                var p: UnsafePointer<UInt8>?; var sz = 0
                CMVideoFormatDescriptionGetH264ParameterSetAtIndex(fmt, parameterSetIndex: i, parameterSetPointerOut: &p,
                                                                   parameterSetSizeOut: &sz, parameterSetCountOut: nil, nalUnitHeaderLengthOut: nil)
                if let p { out.append(contentsOf: start); out.append(p, count: sz) }
            }
        }
        guard let bb = CMSampleBufferGetDataBuffer(sb) else { return }
        let total = CMBlockBufferGetDataLength(bb)
        var raw = Data(count: total)
        raw.withUnsafeMutableBytes { _ = CMBlockBufferCopyDataBytes(bb, atOffset: 0, dataLength: total, destination: $0.baseAddress!) }
        var off = 0
        while off + 4 <= total {
            let len = Int(raw[off]) << 24 | Int(raw[off+1]) << 16 | Int(raw[off+2]) << 8 | Int(raw[off+3])
            off += 4
            guard len > 0, off + len <= total else { break }
            out.append(contentsOf: start); out.append(raw[off..<off+len]); off += len
        }
        let pts = Int64(CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sb)) * 1_000_000)
        onFrame?(out, key, pts)
    }
}

enum AudioConv {
    // Converte o áudio do app para PCM int16 little-endian intercalado
    static func convert(_ sb: CMSampleBuffer) -> (Data, Int, Int)? {
        guard let fmt = CMSampleBufferGetFormatDescription(sb),
              let asbdP = CMAudioFormatDescriptionGetStreamBasicDescription(fmt),
              let bb = CMSampleBufferGetDataBuffer(sb) else { return nil }
        let a = asbdP.pointee
        let len = CMBlockBufferGetDataLength(bb)
        var raw = Data(count: len)
        raw.withUnsafeMutableBytes { _ = CMBlockBufferCopyDataBytes(bb, atOffset: 0, dataLength: len, destination: $0.baseAddress!) }
        let ch = max(1, Int(a.mChannelsPerFrame))
        let isFloat = a.mFormatFlags & kAudioFormatFlagIsFloat != 0
        let bigEndian = a.mFormatFlags & kAudioFormatFlagIsBigEndian != 0
        let nonInter = a.mFormatFlags & kAudioFormatFlagIsNonInterleaved != 0
        let bps = Int(a.mBitsPerChannel) / 8
        guard bps == 2 || (bps == 4 && isFloat) else { return nil }
        let frames = len / (bps * ch)
        var out = [Int16](repeating: 0, count: frames * ch)
        raw.withUnsafeBytes { (p: UnsafeRawBufferPointer) in
            for f in 0..<frames {
                for c in 0..<ch {
                    let idx = nonInter ? (c * frames + f) : (f * ch + c)
                    let o = idx * bps
                    var v: Int16
                    if isFloat {
                        var u = p.load(fromByteOffset: o, as: UInt32.self)
                        if bigEndian { u = u.byteSwapped }
                        v = Int16(max(-1, min(1, Float(bitPattern: u))) * 32767)
                    } else {
                        var u = p.load(fromByteOffset: o, as: UInt16.self)
                        if bigEndian { u = u.byteSwapped }
                        v = Int16(bitPattern: u)
                    }
                    out[f * ch + c] = v
                }
            }
        }
        return (out.withUnsafeBufferPointer { Data(buffer: $0) }, Int(a.mSampleRate), ch)
    }
}

class SampleHandler: RPBroadcastSampleHandler {
    private let server = MirrorServer()
    private let encoder = H264Encoder()
    private let encQ = DispatchQueue(label: "trofeu.enc")
    private var inFlight = 0
    private let lock = NSLock()
    private var audioOn = true
    private var lastRot = -1
    private var lastVideo: CMSampleBuffer?

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        encoder.onFrame = { [weak self] data, key, pts in
            var p = Data([key ? 1 : 0])
            var be = pts.bigEndian
            p.append(Data(bytes: &be, count: 8))
            p.append(data)
            self?.server.send(2, p)
        }
        server.onClient = { [weak self] in
            guard let self else { return }
            let hello: [String: Any] = ["name": UIDevice.current.name, "model": UIDevice.current.model, "app": "Trofeu Espelho"]
            if let j = try? JSONSerialization.data(withJSONObject: hello) { self.server.send(1, j) }
            self.encQ.async {
                self.lastRot = -1
                self.encoder.requestKey()
                if let last = self.lastVideo { self.encoder.encode(last) }
            }
        }
        server.onMessage = { [weak self] type, body in
            guard let self else { return }
            if type == 16, let cfg = try? JSONSerialization.jsonObject(with: body) as? [String: Any] {
                self.encQ.async {
                    self.audioOn = cfg["audio"] as? Bool ?? true
                    self.encoder.configure(fps: cfg["fps"] as? Int ?? 60,
                                           bitrate: cfg["bitrate"] as? Int ?? 10_000_000,
                                           shortSide: cfg["shortSide"] as? Int ?? 1080)
                    if let last = self.lastVideo { self.encoder.encode(last) }
                }
            } else if type == 17 {
                self.encQ.async { self.encoder.requestKey(); if let last = self.lastVideo { self.encoder.encode(last) } }
            }
        }
        server.start()
    }

    override func processSampleBuffer(_ sb: CMSampleBuffer, with type: RPSampleBufferType) {
        switch type {
        case .video:
            if let o = CMGetAttachment(sb, key: RPVideoSampleOrientationKey as CFString, attachmentModeOut: nil) as? NSNumber {
                let deg: Int
                switch o.uint32Value {
                case CGImagePropertyOrientation.right.rawValue: deg = 90
                case CGImagePropertyOrientation.down.rawValue: deg = 180
                case CGImagePropertyOrientation.left.rawValue: deg = 270
                default: deg = 0
                }
                encQ.async {
                    if deg != self.lastRot {
                        self.lastRot = deg
                        var be = UInt16(deg).bigEndian
                        self.server.send(4, Data(bytes: &be, count: 2))
                    }
                }
            }
            guard server.hasClient, !server.isBusy else { encQ.async { self.lastVideo = sb }; return }
            lock.lock(); let busy = inFlight > 1; if !busy { inFlight += 1 }; lock.unlock()
            if busy { return }
            encQ.async {
                self.lastVideo = sb
                self.encoder.encode(sb)
                self.lock.lock(); self.inFlight -= 1; self.lock.unlock()
            }
        case .audioApp:
            guard audioOn, server.hasClient, let (pcm, rate, ch) = AudioConv.convert(sb) else { return }
            var r = UInt32(rate).bigEndian
            var p = Data(bytes: &r, count: 4)
            p.append(UInt8(ch))
            p.append(pcm)
            server.send(3, p)
        default:
            break
        }
    }

    override func broadcastFinished() {
        server.stop()
        encQ.sync { encoder.reset(); lastVideo = nil }
    }
}
