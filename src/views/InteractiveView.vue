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
            v-bind="{
              connected,
              s1Enabled,
              s2Enabled,
              ledS1,
              ledS2,
              selectedSensor,
              selectedSignal,
              debug,
            }"
            @update:settings="updateSettings"
          />
        </SettingsDropdown>
      </template>
    </FDemoAppBar>
    <h1 class="title text-title">PPG EduKit Web (Web Serial)</h1>

    <div style="display: flex; gap: 16px; flex-wrap: wrap; margin: 8px 0; align-items: center">
      <div></div>
    </div>
    <div style="margin-top: 14px">
      <ThreePulseSignal
        v-bind="{
          data: visibleData,
          beat,
          bpm,
        }"
      />
    </div>

    <div v-if="statusMsg" style="margin-top: 8px; color: #666">{{ statusMsg }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onBeforeUnmount } from 'vue'
import ThreePulseSignal from '../components/ThreePulseSignal.vue'
import SensorControls from '../components/SensorControls.vue'
import SettingsDropdown from '../components/SettingsDropdown.vue'
import { WebSerialService } from '../services/webserial'
import { FDemoAppBar, FButton } from 'fari-component-library'

const beat = ref(0)
const bpm = ref(72)

const useMockData = ref(true)
let mockInterval: number | null = null

function generateMockPPGSignal(phase: number, amplitude: number = 100) {
  // Simulate a PPG waveform (Just a sinewave basically)
  let value = amplitude * Math.sin(phase)

  value += amplitude * 0.3 * Math.sin(2 * phase) // Dicrotic notch simulation
  value += (Math.random() - 0.5) * amplitude * 0.1 // Add noise
  return value
}

function startMockData() {
  console.log('fitta')
  if (mockInterval) clearInterval(mockInterval)
  mockInterval = setInterval(() => {
    if (!useMockData.value || connected.value) return

    const heartRate = bpm.value / 60
    const time = Date.now() / 1000
    const phase = (2 * Math.PI * time * heartRate) % (2 * Math.PI)

    const mockValue = generateMockPPGSignal(phase)

    if (s1Enabled.value) {
      pushSample(s1.TIA, mockValue)
      pushSample(s1.HPF, mockValue * 0.9)
      pushSample(s1.LPF, mockValue * 0.8)
      pushSample(s1.AMP, mockValue * 1.1)
      pushSample(s1.HR, bpm.value)
      pushSample(s1.SPO2, 95 + Math.random() * 5)
      pushSample(s1.TEMP, 36.5 + Math.random() * 1)
    }

    if (s2Enabled.value) {
      pushSample(s2.IR, mockValue * 0.95)
      pushSample(s2.RED, mockValue * 0.9)
      pushSample(s2.GREEN, mockValue * 0.85)
      pushSample(s2.HR, bpm.value)
      pushSample(s2.SPO2, 95 + Math.random() * 5)
    }

    if (Math.sin(phase) > 0.95) onRPeak()
  }, 1000 / 100)
}

function stopMockData() {
  if (mockInterval) {
    clearInterval(mockInterval)
    mockInterval = null
  }
}

onMounted(() => {
  if (useMockData.value && !connected.value) startMockData()
})

onBeforeUnmount(() => stopMockData())

function onRPeak() {
  beat.value += 1
}

const service = new WebSerialService()

const connected = ref(false)
const statusMsg = ref('')
const debug = ref(false)
const selectedSensor = ref('S1')
const selectedSignal = ref('TIA')
const s1Enabled = ref(true)
const s2Enabled = ref(false)
const ledS1 = ref('infrared')
const ledS2 = ref('red')

// const s1Options = ['TIA', 'HPF', 'LPF', 'AMP', 'HR', 'SPO2', 'TEMP']
// const s2Options = ['IR', 'RED', 'GREEN', 'HR', 'SPO2']

const maxPoints = 500
const s1 = reactive({ TIA: [], HPF: [], LPF: [], AMP: [], HR: [], SPO2: [], TEMP: [] })
const s2 = reactive({ IR: [], RED: [], GREEN: [], HR: [], SPO2: [] })

function pushSample(arr: any[], v: any) {
  const num = Number.isFinite(v) ? v : NaN
  if (!Number.isFinite(num)) return
  if (arr.length < maxPoints) {
    arr.push(num)
    if (arr.length === maxPoints) {
      arr._rbIndex = 0
      arr._rbFull = true
    }
    return
  }
  if (typeof arr._rbIndex !== 'number') arr._rbIndex = 0
  arr[arr._rbIndex] = num
  arr._rbIndex = (arr._rbIndex + 1) % maxPoints
  arr._rbFull = true
}

service.setOnLine((raw: unknown) => {
  const line = String(raw || '').trim()
  if (!line) return
  if (debug.value) console.log('[RAW]', line)
  const low = line.toLowerCase()
  try {
    if (low.startsWith('s1,')) {
      const parts = line.split(',')
      const vals = parts.slice(1).map((x) => parseFloat(x))
      if (vals.length >= 7) {
        pushSample(s1.TIA, vals[0])
        pushSample(s1.HPF, vals[1])
        pushSample(s1.LPF, vals[2])
        pushSample(s1.AMP, vals[3])
        pushSample(s1.HR, vals[4])
        pushSample(s1.SPO2, vals[5])
        pushSample(s1.TEMP, vals[6])
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
        pushSample(s2.IR, vals[0])
        pushSample(s2.RED, vals[1])
        pushSample(s2.GREEN, vals[2])
        pushSample(s2.HR, vals[3])
        pushSample(s2.SPO2, vals[4])
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
    s1Enabled.value = true
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

  selectedSensor.value = settings.selectedSensor
  selectedSignal.value = settings.selectedSignal
  debug.value = settings.debug
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
</style>
