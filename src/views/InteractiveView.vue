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
    <h1 class="title text-title">PPG EduKit Web (Web Serial)</h1>

    <div style="display: flex; gap: 16px; flex-wrap: wrap; margin: 8px 0; align-items: center">
      <div></div>
    </div>

    <div style="margin-top: 14px">
      <ThreeSignalCanvas :data="visibleData" :color="canvasColor" background="#0b1020" />
    </div>

    <div v-if="statusMsg" style="margin-top: 8px; color: #666">{{ statusMsg }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import ThreeSignalCanvas from '../components/ThreeSignalCanvas2.vue'
import SensorControls from '../components/SensorControls.vue'
import SettingsDropdown from '../components/SettingsDropdown.vue'
import { WebSerialService } from '../services/webserial'
import { FDemoAppBar, FButton } from 'fari-component-library'

const service = new WebSerialService()

const connected = ref(false)
const statusMsg = ref('')
const debug = ref(false)
const selectedSensor = ref('S1')
const selectedSignal = ref('TIA')
const s1Enabled = ref(false)
const s2Enabled = ref(false)
const ledS1 = ref('infrared')
const ledS2 = ref('red')

const s1Options = ['TIA', 'HPF', 'LPF', 'AMP', 'HR', 'SPO2', 'TEMP']
const s2Options = ['IR', 'RED', 'GREEN', 'HR', 'SPO2']

const maxPoints = 500
const s1 = reactive({ TIA: [], HPF: [], LPF: [], AMP: [], HR: [], SPO2: [], TEMP: [] })
const s2 = reactive({ IR: [], RED: [], GREEN: [], HR: [], SPO2: [] })

function pushSample(arr, v) {
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
</style>
