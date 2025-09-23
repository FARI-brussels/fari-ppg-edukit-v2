<template>
  <div v-if="showSetup" class="kiosk-setup-overlay">
    <div class="setup-modal">
      <div class="setup-header">
        <h2>🔧 Kiosk Setup Required</h2>
        <p>This demo needs to authorize your PPG device once before visitors can use it.</p>
      </div>

      <div class="setup-content">
        <div v-if="setupStep === 'initial'" class="step-initial">
          <p><strong>Instructions for Demo Administrator:</strong></p>
          <ol>
            <li>Make sure your PPG device is connected via USB</li>
            <li>Click "Authorize Device" below</li>
            <li>Select your PPG device in the popup</li>
            <li>Setup will complete automatically</li>
          </ol>

          <button @click="startSetup" :disabled="isLoading" class="setup-btn primary">
            {{ isLoading ? 'Checking...' : 'Authorize PPG Device' }}
          </button>
        </div>

        <div v-else-if="setupStep === 'authorizing'" class="step-authorizing">
          <div class="loading-spinner"></div>
          <p>{{ statusMessage }}</p>
          <p class="hint">Look for a browser popup asking you to select a device</p>
        </div>

        <div v-else-if="setupStep === 'testing'" class="step-testing">
          <div class="loading-spinner"></div>
          <p>Testing device connection...</p>
          <div v-if="testData.length > 0" class="test-data">
            <p>✅ Receiving data: {{ testData[testData.length - 1] }}</p>
          </div>
        </div>

        <div v-else-if="setupStep === 'complete'" class="step-complete">
          <div class="success-icon">✅</div>
          <h3>Setup Complete!</h3>
          <p>Device authorized successfully. Your kiosk is ready for visitors.</p>
          <div class="device-info" v-if="deviceInfo">
            <p>
              <strong>Device:</strong> {{ deviceInfo.usbVendorId }}:{{ deviceInfo.usbProductId }}
            </p>
          </div>
          <p class="completion-note">
            This setup screen will not appear again unless you revoke device permissions.
          </p>
        </div>

        <div v-else-if="setupStep === 'error'" class="step-error">
          <div class="error-icon">❌</div>
          <h3>Setup Failed</h3>
          <p class="error-message">{{ errorMessage }}</p>
          <div class="error-actions">
            <button @click="retrySetup" class="setup-btn secondary">Try Again</button>
            <button @click="showTroubleshooting = !showTroubleshooting" class="setup-btn secondary">
              {{ showTroubleshooting ? 'Hide' : 'Show' }} Troubleshooting
            </button>
          </div>

          <div v-if="showTroubleshooting" class="troubleshooting">
            <h4>Troubleshooting Tips:</h4>
            <ul>
              <li>Make sure the PPG device is connected via USB</li>
              <li>Check that no other application is using the device</li>
              <li>Try unplugging and reconnecting the device</li>
              <li>Make sure you're using Chrome, Edge, or another Chromium-based browser</li>
              <li>Check Windows Device Manager for driver issues (Windows only)</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="setup-footer">
        <button
          v-if="setupStep === 'complete'"
          @click="finishSetup"
          class="setup-btn primary large"
        >
          Launch Kiosk Demo
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { WebSerialService } from '../services/webserial'

const emit = defineEmits<{
  setupComplete: [service: WebSerialService]
  setupSkipped: []
}>()

const showSetup = ref(false)
const setupStep = ref<'initial' | 'authorizing' | 'testing' | 'complete' | 'error'>('initial')
const isLoading = ref(false)
const statusMessage = ref('')
const errorMessage = ref('')
const showTroubleshooting = ref(false)
const testData = ref<string[]>([])
const deviceInfo = ref<SerialPortInfo | null>(null)

const service = new WebSerialService()

onMounted(async () => {
  // Check if device is already authorized
  const hasDevice = await service.hasAuthorizedDevices()

  if (!hasDevice) {
    showSetup.value = true
  } else {
    // Device already authorized, try auto-connect
    try {
      await service.autoConnect()
      emit('setupComplete', service)
    } catch (error) {
      // Auto-connect failed, show setup
      showSetup.value = true
      setupStep.value = 'error'
      errorMessage.value = 'Auto-connection failed. Device may need re-authorization.'
    }
  }
})

async function startSetup() {
  setupStep.value = 'authorizing'
  statusMessage.value = 'Waiting for device selection...'
  isLoading.value = true

  try {
    // Show device selection popup
    await service.connect({ baudRate: 115200 })

    // Get device info
    deviceInfo.value = service.getDeviceInfo()

    setupStep.value = 'testing'

    // Test data reception
    service.setOnLine((line) => {
      testData.value.push(line)
      if (testData.value.length > 5) {
        testData.value = testData.value.slice(-5) // Keep only last 5 lines
      }
    })

    // Wait for some test data
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('No data received from device within 10 seconds'))
      }, 10000)

      const checkData = () => {
        if (testData.value.length > 0) {
          clearTimeout(timeout)
          resolve()
        } else {
          setTimeout(checkData, 500)
        }
      }
      checkData()
    })

    setupStep.value = 'complete'
  } catch (error: any) {
    setupStep.value = 'error'
    if (error.message.includes('No device selected')) {
      errorMessage.value =
        'Device selection was cancelled. Please try again and select your PPG device.'
    } else if (error.message.includes('No data received')) {
      errorMessage.value = 'Device connected but no data received. Check device power and firmware.'
    } else {
      errorMessage.value = error.message || 'An unknown error occurred during setup.'
    }
  } finally {
    isLoading.value = false
  }
}

function retrySetup() {
  setupStep.value = 'initial'
  errorMessage.value = ''
  showTroubleshooting.value = false
  testData.value = []
}

function finishSetup() {
  showSetup.value = false
  emit('setupComplete', service)
}
</script>

<style scoped lang="scss">
.kiosk-setup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.setup-modal {
  background: white;
  border-radius: 12px;
  padding: 30px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.setup-header {
  text-align: center;
  margin-bottom: 30px;

  h2 {
    margin: 0 0 10px 0;
    color: #333;
    font-size: 24px;
  }

  p {
    margin: 0;
    color: #666;
    font-size: 16px;
  }
}

.setup-content {
  margin-bottom: 20px;
}

.step-initial {
  ol {
    text-align: left;
    margin: 20px 0;
    padding-left: 20px;

    li {
      margin: 8px 0;
      color: #444;
    }
  }
}

.step-authorizing,
.step-testing {
  text-align: center;

  .hint {
    font-size: 14px;
    color: #888;
    font-style: italic;
    margin-top: 10px;
  }
}

.step-complete {
  text-align: center;

  .success-icon {
    font-size: 48px;
    margin-bottom: 15px;
  }

  h3 {
    color: #4caf50;
    margin: 0 0 15px 0;
  }

  .device-info {
    background: #f5f5f5;
    padding: 10px;
    border-radius: 6px;
    margin: 15px 0;
    font-family: monospace;
    font-size: 14px;
  }

  .completion-note {
    font-size: 14px;
    color: #888;
    margin-top: 15px;
  }
}

.step-error {
  text-align: center;

  .error-icon {
    font-size: 48px;
    margin-bottom: 15px;
  }

  h3 {
    color: #f44336;
    margin: 0 0 15px 0;
  }

  .error-message {
    background: #ffebee;
    border: 1px solid #ffcdd2;
    padding: 15px;
    border-radius: 6px;
    margin: 15px 0;
    color: #c62828;
  }

  .error-actions {
    margin: 20px 0;
    display: flex;
    gap: 10px;
    justify-content: center;
  }
}

.troubleshooting {
  text-align: left;
  background: #f8f9fa;
  padding: 20px;
  border-radius: 6px;
  margin-top: 15px;

  h4 {
    margin: 0 0 10px 0;
    color: #333;
  }

  ul {
    margin: 0;
    padding-left: 20px;

    li {
      margin: 8px 0;
      color: #555;
    }
  }
}

.test-data {
  background: #e8f5e8;
  padding: 10px;
  border-radius: 6px;
  margin: 10px 0;
  font-family: monospace;
  font-size: 12px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4caf50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.setup-btn {
  border: none;
  border-radius: 6px;
  padding: 12px 24px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;

  &.primary {
    background: #4caf50;
    color: white;

    &:hover:not(:disabled) {
      background: #45a049;
    }
  }

  &.secondary {
    background: #f5f5f5;
    color: #333;

    &:hover {
      background: #eeeeee;
    }
  }

  &.large {
    padding: 15px 30px;
    font-size: 18px;
    font-weight: bold;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.setup-footer {
  text-align: center;
  margin-top: 30px;
}
</style>
