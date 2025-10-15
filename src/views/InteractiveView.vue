<template>
  <div class="view bg-color-primary">
    <FDemoAppBar color="primary" @exit="$router.push('/')" :dense="false">
      <template #actions>
        <div
          style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px"
        >
          <FButton
            @click="() => (!connected ? onConnect() : onDisconnect())"
            :label="!connected ? 'Connect' : 'Disconnect'"
            onDark
          >
            <template #append-icon>
              <div
                class="status-indicator"
                :style="{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: connected ? '#00e676' : '#ff1744',
                }"
              />
            </template>
          </FButton>
        </div>

        <SettingsDropdown icon="settings" location="bottom-left" title="Settings">
          <SensorControls
            :connected="connected"
            :s1Enabled="s1Enabled"
            :s2Enabled="s2Enabled"
            :ledS1="ledS1"
            :ledS2="ledS2"
            :selectedSensor="selectedSensor"
            :selectedSignal="selectedSignal"
            :debug="debug"
            @update:settings="updateSettings"
          />
        </SettingsDropdown>
      </template>
    </FDemoAppBar>
    <h1 class="title text-title">PPG EduKit Web</h1>

    <div style="display: flex; gap: 16px; flex-wrap: wrap; margin: 8px 0; align-items: center">
      <div></div>
    </div>

    <div style="margin-top: 14px">
      <ThreeSignalCanvas
        :data="visibleData"
        :color="canvasColor"
        :peakDetected="peakDetected"
        background="#0b1020"
      />
    </div>

    <div v-if="calculatedHeartRate > 0" style="margin-top: 16px; display: flex; justify-content: center;">
      <div
        style="
          padding: 16px 24px;
          background: rgba(0, 229, 255, 0.1);
          border-radius: 12px;
          border: 2px solid rgba(0, 229, 255, 0.3);
          display: inline-block;
          text-align: center;
        "
      >
        <div style="font-size: 14px; color: #00e5ff; margin-bottom: 8px; font-weight: 500">
          Heart Rate
        </div>
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
          <span
            class="heart-icon"
            :class="{ beat: peakDetected }"
            :style="{ color: canvasColor }"
            aria-label="heartbeat"
            role="img"
          >❤️</span>
          <div style="font-size: 48px; color: #00e5ff; font-weight: bold; line-height: 1">
            {{ calculatedHeartRate }} <span style="font-size: 24px">BPM</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="statusMsg" style="margin-top: 8px; color: #666">{{ statusMsg }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import ThreeSignalCanvas from '../components/ThreeSignalCanvas2.vue'
import SensorControls from '../components/SensorControls.vue'
import SettingsDropdown from '../components/SettingsDropdown.vue'
import { WebSerialService } from '../services/webserial'
import { createPeakDetector } from '../services/peakDetection'
import { FDemoAppBar, FButton } from 'fari-component-library'

const service = new WebSerialService()
const peakDetector = createPeakDetector(50) // 50 Hz sampling rate

const connected = ref(false)
const statusMsg = ref('')
const debug = ref(false)
const selectedSensor = ref('S1')
const selectedSignal = ref('AMP') // Default to AMP instead of TIA
const s1Enabled = ref(true) // Default S1 to enabled
const s2Enabled = ref(false)
const ledS1 = ref('infrared')
const ledS2 = ref('red')
const peakDetected = ref(false)
const calculatedHeartRate = ref(0)

// Buffer size for 5-second window at 50 Hz (5s * 50 samples/s = 250 samples)
const maxPoints = 250
const s1 = reactive({ TIA: [], HPF: [], LPF: [], AMP: [], HR: [], SPO2: [], TEMP: [] })
const s2 = reactive({ IR: [], RED: [], GREEN: [], HR: [], SPO2: [] })

function pushSample(arr, v, signalType = '') {
  const num = Number.isFinite(v) ? v : NaN
  if (!Number.isFinite(num)) return
  
  // Determine current index before pushing
  let currentIndex
  if (arr.length < maxPoints) {
    currentIndex = arr.length
    arr.push(num)
    if (arr.length === maxPoints) {
      arr._rbIndex = 0
      arr._rbFull = true
    }
  } else {
    if (typeof arr._rbIndex !== 'number') arr._rbIndex = 0
    currentIndex = arr._rbIndex
    arr[arr._rbIndex] = num
    arr._rbIndex = (arr._rbIndex + 1) % maxPoints
    arr._rbFull = true
  }
  
  // Detect peaks only for the currently selected signal (works for both S1 and S2)
  const currentSensor = selectedSensor.value
  const isS1Signal = currentSensor === 'S1' && signalType === selectedSignal.value
  const isS2Signal = currentSensor === 'S2' && signalType === selectedSignal.value
  
  if (isS1Signal || isS2Signal) {
    const isPeak = peakDetector.detectPeak(arr, currentIndex, signalType)
    if (isPeak) {
      peakDetected.value = true
      calculatedHeartRate.value = peakDetector.getHeartRate()
      // Reset peak indicator after animation
      setTimeout(() => {
        peakDetected.value = false
      }, 300)
    }
  }
}

service.setOnLine((raw) => {
  const line = String(raw || '').trim()
  if (!line) return
  if (debug.value) console.log('[RAW]', line)
  const low = line.toLowerCase()
  try {
    if (low.startsWith('s1,')) {
      const parts = line.split(',')
      const vals = parts.slice(1).map((x) => parseFloat(x))
      if (vals.length >= 7) {
        pushSample(s1.TIA, vals[0], 'TIA')
        pushSample(s1.HPF, vals[1], 'HPF')
        pushSample(s1.LPF, vals[2], 'LPF')
        pushSample(s1.AMP, vals[3], 'AMP')
        pushSample(s1.HR, vals[4], 'HR')
        pushSample(s1.SPO2, vals[5], 'SPO2')
        pushSample(s1.TEMP, vals[6], 'TEMP')
        if (debug.value)
          console.log('[S1]', {
            TIA: vals[0],
            HPF: vals[1],
            LPF: vals[2],
            AMP: vals[3],
            HR: vals[4],
            SPO2: vals[5],
            TEMP: vals[6],
          })
        statusMsg.value = ''
      }
      return
    }
    if (low.startsWith('s2,')) {
      const parts = line.split(',')
      const vals = parts.slice(1).map((x) => parseFloat(x))
      if (vals.length >= 5) {
        pushSample(s2.IR, vals[0], 'IR')
        pushSample(s2.RED, vals[1], 'RED')
        pushSample(s2.GREEN, vals[2], 'GREEN')
        pushSample(s2.HR, vals[3], 'HR')
        pushSample(s2.SPO2, vals[4], 'SPO2')
        if (debug.value)
          console.log('[S2]', {
            IR: vals[0],
            RED: vals[1],
            GREEN: vals[2],
            HR: vals[3],
            SPO2: vals[4],
          })
        statusMsg.value = ''
      }
      return
    }
    if (low.startsWith('i,')) {
      if (debug.value) console.log('[INFO]', line)
      statusMsg.value = line
      return
    }
  } catch (e) {
    console.warn('Parse error for line', line, e)
  }
})

async function onConnect() {
  try {
    await service.connect({ baudRate: 115200 })
    connected.value = true
    statusMsg.value = 'Connected'
    
    // Apply UI-configured sampling frequency and device state
    await service.setSamplingFrequency(50)

    // Ensure sensor enable state matches UI
    await service.setSensorEnabled('S1', s1Enabled.value)
    await service.setSensorEnabled('S2', s2Enabled.value)

    // Ensure LED modes match UI for both sensors
    await service.setLedMode('S1', ledS1.value)
    await service.setLedMode('S2', ledS2.value)
  } catch (e) {
    statusMsg.value = String(e)
  }
}

async function onDisconnect() {
  try {
    await service.disconnect()
    connected.value = false
    s1Enabled.value = false
    s2Enabled.value = false
    statusMsg.value = 'Disconnected'
    peakDetector.reset()
    calculatedHeartRate.value = 0
  } catch (e) {
    statusMsg.value = String(e)
  }
}

async function updateSettings(settings: {
  s1Enabled: boolean
  s2Enabled: boolean
  ledS1: string
  ledS2: string
  selectedSensor: string
  selectedSignal: string
  debug: boolean
}) {
  // Handle sensor enable/disable changes
  if (settings.s1Enabled !== s1Enabled.value) {
    try {
      await service.setSensorEnabled('S1', settings.s1Enabled)
      s1Enabled.value = settings.s1Enabled
    } catch (e) {
      statusMsg.value = String(e)
    }
  }
  if (settings.s2Enabled !== s2Enabled.value) {
    try {
      await service.setSensorEnabled('S2', settings.s2Enabled)
      s2Enabled.value = settings.s2Enabled
    } catch (e) {
      statusMsg.value = String(e)
    }
  }

  // Handle LED mode changes
  if (settings.ledS1 !== ledS1.value) {
    try {
      await service.setLedMode('S1', settings.ledS1)
      ledS1.value = settings.ledS1
    } catch (e) {
      statusMsg.value = String(e)
    }
  }
  if (settings.ledS2 !== ledS2.value) {
    try {
      await service.setLedMode('S2', settings.ledS2)
      ledS2.value = settings.ledS2
    } catch (e) {
      statusMsg.value = String(e)
    }
  }

  // Update other settings
  const sensorChanged = selectedSensor.value !== settings.selectedSensor
  const signalChanged = selectedSignal.value !== settings.selectedSignal
  
  selectedSensor.value = settings.selectedSensor
  selectedSignal.value = settings.selectedSignal
  debug.value = settings.debug
  
  // Reset peak detector when switching sensors or signals
  if (sensorChanged || signalChanged) {
    peakDetector.reset()
    calculatedHeartRate.value = 0
  }
}

const visibleData = computed(() => {
  const sensor = selectedSensor.value
  const sig = selectedSignal.value
  if (sensor === 'S1') return s1[sig] || []
  if (sensor === 'S2') return s2[sig] || []
  return []
})

const colorMap = {
  S1: {
    TIA: '#00e5ff',
    HPF: '#6a5acd',
    LPF: '#1de9b6',
    AMP: '#ff8a65',
    HR: '#ffd54f',
    SPO2: '#a5d6a7',
    TEMP: '#ff5252',
  },
  S2: {
    IR: '#ff1744',
    RED: '#ff5252',
    GREEN: '#00e676',
    HR: '#ffd740',
    SPO2: '#b39ddb',
  },
}

const canvasColor = computed(() => {
  const s = selectedSensor.value
  const k = selectedSignal.value
  return (colorMap[s] && colorMap[s][k]) || '#00e5ff'
})
</script>

<style scoped lang="scss">
/* Unchanged styles */
.view {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  height: 100%;
  width: 100%;
  position: relative;
}

.title {
  position: absolute;
  top: 10rem;
  left: 40%;
}

:deep(.app-bar).dense {
  position: absolute;
  top: 0;
  z-index: 2000000;
  box-sizing: border-box;
  height: 6rem;
}

button {
  padding: 6px 10px;
}
select {
  padding: 4px 6px;
}

.heart-icon {
  font-size: 28px;
  display: inline-block;
  transform-origin: center;
  filter: drop-shadow(0 0 6px rgba(255, 0, 0, 0.25));
}

.heart-icon.beat {
  animation: heart-beat 300ms ease-out;
}

@keyframes heart-beat {
  0% { transform: scale(1); }
  35% { transform: scale(1.35); }
  100% { transform: scale(1); }
}
</style>
