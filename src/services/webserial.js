// Web Serial service for PPG EduKit Web

export class LineBreakTransformer {
  constructor() {
    this.container = ''
  }
  transform(chunk, controller) {
    this.container += chunk
    const lines = this.container.split(/\r?\n/)
    this.container = lines.pop()
    for (const line of lines) {
      if (line.length > 0) controller.enqueue(line)
    }
  }
  flush(controller) {
    if (this.container) controller.enqueue(this.container)
  }
}

export class WebSerialService {
  constructor() {
    this.port = null
    this.reader = null
    this.isOpen = false
    this.onLineCallback = null
  }

  async connect(options = { baudRate: 115200 }) {
    console.log('[Serial] Requesting port...')
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API not supported in this browser')
    }
    const ports = await navigator.serial.getPorts()
    console.log('[Serial] Existing ports:', ports)
    this.port = await navigator.serial.requestPort()
    console.log('[Serial] Port selected. Opening with options:', options)
    await this.port.open(options)
    this.isOpen = true

    try {
      if (this.port.setSignals) {
        await this.port.setSignals({ dataTerminalReady: true })
        console.log('[Serial] DTR set true')
      }
    } catch (e) {
      console.warn('Failed to set DTR signal:', e)
    }

    const textDecoder = new TextDecoderStream()
    this.port.readable.pipeTo(textDecoder.writable).catch(() => {})
    const lineStream = textDecoder.readable.pipeThrough(
      new TransformStream(new LineBreakTransformer()),
    )
    this.reader = lineStream.getReader()

    console.log('[Serial] Read loop starting')
    ;(async () => {
      try {
        while (this.isOpen) {
          const { value, done } = await this.reader.read()
          if (done) break
          if (value && this.onLineCallback) this.onLineCallback(value)
        }
        console.log('[Serial] Read loop ended')
      } catch (err) {
        console.error('[Serial] Read loop error', err)
      }
    })()
  }

  setOnLine(callback) {
    console.log('[Serial] onLine callback set')
    this.onLineCallback = callback
  }

  async disconnect() {
    console.log('[Serial] Disconnecting...')
    this.isOpen = false
    try {
      if (this.reader) {
        await this.reader.cancel()
        this.reader.releaseLock()
      }
    } catch {}
    try {
      if (this.port) await this.port.close()
    } catch {}
    this.port = null
    console.log('[Serial] Disconnected')
  }

  async sendRaw(command) {
    if (!this.port || !this.port.writable) throw new Error('Port not open')
    const writer = this.port.writable.getWriter()
    const encoder = new TextEncoder()
    try {
      await writer.write(encoder.encode(command.endsWith('\r\n') ? command : command + '\r\n'))
      console.log('[Serial → Device]', JSON.stringify(command))
    } finally {
      writer.releaseLock()
    }
  }

  async setSensorEnabled(sensor, enabled) {
    const map = {
      S1: { true: 'a', false: 'b' },
      S2: { true: 'c', false: 'd' },
    }
    const cmd = map[sensor]?.[String(!!enabled)]
    if (!cmd) throw new Error('Unknown sensor for enable/disable')
    console.log('[Serial Cmd] setSensorEnabled', { sensor, enabled, cmd })
    await this.sendRaw(cmd)
  }

  async setLedMode(sensor, mode) {
    const normalized = String(mode || '').toLowerCase()
    if (sensor === 'S1') {
      const map = { red: 'r', green: 'g', infrared: 'i', off: 'o' }
      const cmd = map[normalized]
      if (!cmd) throw new Error('Mode not supported on S1')
      console.log('[Serial Cmd] setLedMode', { sensor, mode, cmd })
      await this.sendRaw(cmd)
      return
    }
    if (sensor === 'S2') {
      const map = { red: 'R', green: 'G', blue: 'B', infrared: 'I', off: 'O' }
      const cmd = map[normalized]
      if (!cmd) throw new Error('Unknown LED mode')
      console.log('[Serial Cmd] setLedMode', { sensor, mode, cmd })
      await this.sendRaw(cmd)
      return
    }
    throw new Error('Unknown sensor for LED mode')
  }

  async setLedIntensity(sensor, level) {
    const allowed = [5, 10, 15, 20, 25, 30, 35]
    if (!allowed.includes(level)) throw new Error('Invalid intensity')
    if (sensor === 'S1') {
      const idx = allowed.indexOf(level)
      console.log('[Serial Cmd] setLedIntensity', { sensor, level, cmd: String(idx) })
      await this.sendRaw(String(idx))
      return
    }
    if (sensor === 'S2') {
      const letters = ['t', 'u', 'v', 'w', 'x', 'y', 'z']
      const idx = allowed.indexOf(level)
      console.log('[Serial Cmd] setLedIntensity', { sensor, level, cmd: letters[idx] })
      await this.sendRaw(letters[idx])
      return
    }
    throw new Error('Unknown sensor for intensity')
  }
}
