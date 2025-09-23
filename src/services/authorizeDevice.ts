// // Enhanced WebSerialService for kiosk mode
// // Replace your existing WebSerialService with this version

// export class WebSerialService {
//   private port: SerialPort | null = null
//   private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
//   private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
//   private onLineCallback: ((line: string) => void) | null = null
//   private isReading = false
//   private reconnectAttempts = 0
//   private maxReconnectAttempts = 5
//   private reconnectDelay = 2000 // 2 seconds

//   constructor() {
//     this.setupDisconnectionHandler()
//   }

//   setOnLine(callback: (line: string) => void) {
//     this.onLineCallback = callback
//   }

//   // Check if Web Serial API is supported
//   isSupported(): boolean {
//     return 'serial' in navigator
//   }

//   // Check if there are previously authorized devices
//   async hasAuthorizedDevices(): Promise<boolean> {
//     if (!this.isSupported()) return false
//     try {
//       const ports = await navigator.serial.getPorts()
//       return ports.length > 0
//     } catch (error) {
//       console.error('Error checking authorized devices:', error)
//       return false
//     }
//   }

//   // Auto-connect to previously authorized device (no popup)
//   async autoConnect(options: SerialOptions = { baudRate: 115200 }): Promise<void> {
//     if (!this.isSupported()) {
//       throw new Error('Web Serial API not supported in this browser')
//     }

//     const ports = await navigator.serial.getPorts()

//     if (ports.length === 0) {
//       throw new Error('No previously authorized devices found')
//     }

//     // For multiple devices, you might want to add device identification logic here
//     // For now, we'll use the first available port
//     const targetPort = ports[0]

//     // If you have multiple devices, you could filter by vendor/product ID:
//     // const targetPort = ports.find(port => {
//     //   const info = port.getInfo();
//     //   return info.usbVendorId === YOUR_VENDOR_ID && info.usbProductId === YOUR_PRODUCT_ID;
//     // });

//     if (!targetPort) {
//       throw new Error('Target device not found in authorized devices')
//     }

//     await this.connectToPort(targetPort, options)
//     this.reconnectAttempts = 0 // Reset reconnection counter on success
//   }

//   // Manual connect with device selection popup (for initial setup)
//   async connect(options: SerialOptions = { baudRate: 115200 }): Promise<void> {
//     if (!this.isSupported()) {
//       throw new Error('Web Serial API not supported in this browser')
//     }

//     try {
//       // This shows the device selection popup
//       const port = await navigator.serial.requestPort()
//       await this.connectToPort(port, options)
//       this.reconnectAttempts = 0
//     } catch (error: any) {
//       if (error.name === 'NotFoundError') {
//         throw new Error('No device selected')
//       }
//       throw error
//     }
//   }

//   // Helper method to connect to a specific port
//   private async connectToPort(port: SerialPort, options: SerialOptions): Promise<void> {
//     try {
//       if (port.readable && port.readable.locked) {
//         throw new Error('Port is already in use')
//       }

//       await port.open(options)
//       this.port = port

//       // Set up reader and writer
//       if (port.readable) {
//         this.reader = port.readable.getReader()
//       }
//       if (port.writable) {
//         this.writer = port.writable.getWriter()
//       }

//       // Start reading data
//       this.startReading()

//       console.log('Connected to device:', port.getInfo())
//     } catch (error: any) {
//       throw new Error(`Failed to connect to device: ${error.message}`)
//     }
//   }

//   // Start reading data from the device
//   private async startReading(): Promise<void> {
//     if (!this.reader || this.isReading) return

//     this.isReading = true
//     let buffer = ''

//     try {
//       while (this.isReading && this.reader) {
//         const { value, done } = await this.reader.read()
//         if (done) break

//         // Convert uint8Array to string
//         const text = new TextDecoder().decode(value)
//         buffer += text

//         // Process complete lines
//         const lines = buffer.split('\n')
//         buffer = lines.pop() || '' // Keep the incomplete line in buffer

//         for (const line of lines) {
//           const trimmedLine = line.trim()
//           if (trimmedLine && this.onLineCallback) {
//             this.onLineCallback(trimmedLine)
//           }
//         }
//       }
//     } catch (error: any) {
//       console.error('Reading error:', error)

//       // If it's a connection error, try to reconnect
//       if (this.shouldAttemptReconnect(error)) {
//         this.attemptReconnect()
//       }
//     } finally {
//       this.isReading = false
//     }
//   }

//   // Check if we should attempt reconnection based on the error
//   private shouldAttemptReconnect(error: any): boolean {
//     // Reconnect on network errors, device disconnection, etc.
//     const reconnectableErrors = ['NetworkError', 'NotReadableError', 'InvalidStateError']

//     return (
//       reconnectableErrors.includes(error.name) ||
//       error.message.includes('device') ||
//       error.message.includes('disconnect')
//     )
//   }

//   // Attempt to reconnect to the device
//   private async attemptReconnect(): Promise<void> {
//     if (this.reconnectAttempts >= this.maxReconnectAttempts) {
//       console.log('Max reconnection attempts reached')
//       return
//     }

//     this.reconnectAttempts++
//     console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`)

//     // Clean up current connection
//     await this.cleanupConnection()

//     // Wait before reconnecting
//     await new Promise((resolve) => setTimeout(resolve, this.reconnectDelay))

//     try {
//       await this.autoConnect()
//       console.log('Reconnected successfully')
//     } catch (error) {
//       console.error('Reconnection failed:', error)
//       // Try again after delay
//       setTimeout(() => this.attemptReconnect(), this.reconnectDelay)
//     }
//   }

//   // Set up handler for device disconnection
//   private setupDisconnectionHandler(): void {
//     if (!this.isSupported()) return

//     navigator.serial.addEventListener('disconnect', (event) => {
//       console.log('Device disconnected:', event)
//       if (this.port === event.target) {
//         this.handleDisconnection()
//       }
//     })
//   }

//   // Handle unexpected disconnection
//   private handleDisconnection(): void {
//     console.log('Handling device disconnection...')
//     this.isReading = false
//     this.attemptReconnect()
//   }

//   // Disconnect from device
//   async disconnect(): Promise<void> {
//     this.isReading = false
//     this.reconnectAttempts = this.maxReconnectAttempts // Prevent auto-reconnect
//     await this.cleanupConnection()
//   }

//   // Clean up connection resources
//   private async cleanupConnection(): Promise<void> {
//     if (this.reader) {
//       try {
//         await this.reader.cancel()
//         this.reader.releaseLock()
//       } catch (e) {
//         console.warn('Reader cleanup error:', e)
//       }
//       this.reader = null
//     }

//     if (this.writer) {
//       try {
//         this.writer.releaseLock()
//       } catch (e) {
//         console.warn('Writer cleanup error:', e)
//       }
//       this.writer = null
//     }

//     if (this.port && this.port.readable) {
//       try {
//         await this.port.close()
//       } catch (e) {
//         console.warn('Port close error:', e)
//       }
//     }

//     this.port = null
//   }

//   // Check if currently connected
//   isConnected(): boolean {
//     return this.port !== null && this.port.readable && !this.port.readable.locked
//   }

//   // Send command to device
//   async sendCommand(command: string): Promise<void> {
//     if (!this.writer) {
//       throw new Error('Device not connected')
//     }

//     const data = new TextEncoder().encode(command + '\n')
//     await this.writer.write(data)
//   }

//   // Device-specific commands
//   async setSensorEnabled(sensor: string, enabled: boolean): Promise<void> {
//     await this.sendCommand(`${sensor}_EN,${enabled ? '1' : '0'}`)
//   }

//   async setLedMode(sensor: string, mode: string): Promise<void> {
//     await this.sendCommand(`${sensor}_LED,${mode}`)
//   }

//   // Get device information
//   getDeviceInfo(): SerialPortInfo | null {
//     return this.port ? this.port.getInfo() : null
//   }

//   // Get list of authorized devices
//   async getAuthorizedDevices(): Promise<SerialPortInfo[]> {
//     if (!this.isSupported()) return []

//     try {
//       const ports = await navigator.serial.getPorts()
//       return ports.map((port) => port.getInfo())
//     } catch (error) {
//       console.error('Error getting authorized devices:', error)
//       return []
//     }
//   }
// }
